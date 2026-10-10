import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioQueue } from '../services/audioQueue';

// Mock Web Audio
class MockAudioBuffer {
  duration = 1;
  length = 24000;
  sampleRate = 24000;
  numberOfChannels = 1;
  getChannelData() {
    return new Float32Array(24000);
  }
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  onended: any = null;
  connectedTo: any = null;
  playbackRate = { value: 1 };
  connect(dest: any) {
    this.connectedTo = dest;
  }
  start() {
    // Simulated playback in tests
  }
  stop() {
    // Stopped
  }
}

class MockAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  connect() {}
  getByteFrequencyData(arr: Uint8Array) {
    arr.fill(128);
  }
}

class MockAudioContext {
  state = 'running';
  destination = {};
  createBuffer() {
    return new MockAudioBuffer();
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  async resume() {
    this.state = 'running';
  }
}

describe('AudioQueue Service', () => {
  let queue: AudioQueue;

  beforeEach(() => {
    (globalThis as any).window = {
      AudioContext: MockAudioContext,
      webkitAudioContext: MockAudioContext,
      requestAnimationFrame: vi.fn(),
      cancelAnimationFrame: vi.fn(),
    };
    queue = new AudioQueue();
    queue.initContext();
  });

  it('1. maintains ordered playback when items arrive in order', async () => {
    const started: number[] = [];
    const ended: number[] = [];

    queue.setCallbacks({
      onSentenceStart: (_text, idx) => started.push(idx),
      onSentenceEnd: (idx) => ended.push(idx),
    });

    const buf0 = new MockAudioBuffer() as any;
    const buf1 = new MockAudioBuffer() as any;

    queue.enqueue(0, 'Sentence 0', Promise.resolve(buf0));
    queue.enqueue(1, 'Sentence 1', Promise.resolve(buf1));

    // Wait microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(started).toEqual([0]);
    expect(queue.getIsPlaying()).toBe(true);

    // Simulate sentence 0 ending
    const currentSource = (queue as any).currentSource;
    expect(currentSource).toBeTruthy();
    currentSource.onended();

    // Sentence 1 should now start
    expect(ended).toEqual([0]);
    expect(started).toEqual([0, 1]);
  });

  it('2. guarantees ordered playback when sentence 1 resolves before sentence 0', async () => {
    const started: number[] = [];
    queue.setCallbacks({
      onSentenceStart: (_text, idx) => started.push(idx),
    });

    let resolve0!: (val: any) => void;
    const promise0 = new Promise((resolve) => { resolve0 = resolve; });

    let resolve1!: (val: any) => void;
    const promise1 = new Promise((resolve) => { resolve1 = resolve; });

    queue.enqueue(0, 'Sentence 0', promise0 as any);
    queue.enqueue(1, 'Sentence 1', promise1 as any);

    // Resolve sentence 1 FIRST
    resolve1(new MockAudioBuffer());
    await Promise.resolve();
    await Promise.resolve();

    // Sentence 1 must NOT play yet because sentence 0 hasn't arrived!
    expect(started).toEqual([]);
    expect(queue.getIsPlaying()).toBe(false);

    // Now resolve sentence 0
    resolve0(new MockAudioBuffer());
    await Promise.resolve();
    await Promise.resolve();

    // Sentence 0 starts playing first!
    expect(started).toEqual([0]);
  });

  it('3. interruption immediately stops active playback and clears queue', async () => {
    let emptyCalled = false;
    queue.setCallbacks({
      onQueueEmpty: () => { emptyCalled = true; },
    });

    const buf = new MockAudioBuffer() as any;
    queue.enqueue(0, 'Sentence 0', Promise.resolve(buf));
    queue.enqueue(1, 'Sentence 1', Promise.resolve(buf));
    await Promise.resolve();
    await Promise.resolve();

    expect(queue.getIsPlaying()).toBe(true);

    // Interrupt
    queue.interrupt();

    expect(queue.getIsPlaying()).toBe(false);
    expect(queue.getQueueSize()).toBe(0);
    expect((queue as any).currentSource).toBeNull();
    expect(emptyCalled).toBe(true);
  });

  it('4. in-flight audio arriving after interrupt is discarded (epoch check)', async () => {
    const started: number[] = [];
    queue.setCallbacks({
      onSentenceStart: (_text, idx) => started.push(idx),
    });

    let resolveAudio!: (val: any) => void;
    const audioPromise = new Promise((resolve) => { resolveAudio = resolve; });

    queue.enqueue(0, 'Stale Sentence', audioPromise as any);

    // Interrupt before audio resolves
    queue.interrupt();

    // Now resolve the late audio
    resolveAudio(new MockAudioBuffer());
    await Promise.resolve();
    await Promise.resolve();

    // Should NOT play the stale sentence
    expect(started).toEqual([]);
    expect(queue.getIsPlaying()).toBe(false);
  });

  it('5. triggers onQueueEmpty when all sentences finish playing', async () => {
    let emptyCount = 0;
    queue.setCallbacks({
      onQueueEmpty: () => { emptyCount++; },
    });

    const buf = new MockAudioBuffer() as any;
    queue.enqueue(0, 'Sole Sentence', Promise.resolve(buf));
    await Promise.resolve();
    await Promise.resolve();

    // Simulate completion
    const source = (queue as any).currentSource;
    source.onended();

    expect(emptyCount).toBe(1);
    expect(queue.getIsPlaying()).toBe(false);
  });
});
