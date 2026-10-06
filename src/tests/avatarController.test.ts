import { describe, it, expect, beforeEach } from 'vitest';
import {
  AvatarController,
  mapMoveToExpression,
} from '../services/avatarController';

describe('AvatarController State Machine (SPEC.md Step 4)', () => {
  let controller: AvatarController;

  beforeEach(() => {
    controller = new AvatarController();
  });

  // Test Case 1: Initial state and idle breathing
  it('1. initializes in idle state with breathing and neutral expression', () => {
    expect(controller.getState()).toBe('idle');
    expect(controller.getExpression()).toBe('neutral');

    const update1 = controller.update(0.016, 0);
    expect(update1.state).toBe('idle');
    expect(update1.expression).toBe('neutral');
    expect(update1.pose.spine.x).toBeDefined();
    expect(update1.pose.chest.x).toBeDefined();
    // Spine pitch should cycle with breathing
    const update2 = controller.update(0.5, 0);
    expect(update2.pose.spine.x).not.toBe(0);
  });

  // Test Case 2: State Transitions
  it('2. transitions across all specified states (listening, thinking, speaking, pointing_board)', () => {
    // Listening
    controller.setState('listening');
    expect(controller.getState()).toBe('listening');
    let out = controller.update(0.016, 0);
    // Head tilt in listening mode
    expect(out.pose.head.z).toBeGreaterThan(0.05);

    // Thinking
    controller.setState('thinking');
    expect(controller.getState()).toBe('thinking');
    out = controller.update(0.016, 0);
    // Looks slightly up and aside (negative pitch x, positive yaw y)
    expect(out.pose.head.x).toBeLessThan(0);
    expect(out.pose.head.y).toBeGreaterThan(0);

    // Speaking
    controller.setState('speaking');
    expect(controller.getState()).toBe('speaking');
    out = controller.update(0.016, 0.5);
    // Arm gestures active in speaking mode
    expect(out.pose.rightUpperArm.x).toBeGreaterThan(0.2);

    // Pointing Board
    controller.triggerBoardPoint(2.0);
    expect(controller.getState()).toBe('pointing_board');
    out = controller.update(0.2, 0);
    // Head and arm turn right towards digital board
    expect(out.pose.head.y).toBeGreaterThan(0.05);
    expect(out.pose.rightUpperArm.x).toBeGreaterThan(0.1);
  });

  // Test Case 3: Interruption handling within 100ms
  it('3. handles interruption immediately: moves to listening and resets mouth shapes', () => {
    controller.setState('speaking');
    // Simulate speaking audio level
    controller.update(0.016, 0.8);
    expect(controller.getState()).toBe('speaking');

    // Trigger interruption
    controller.handleInterruption();
    expect(controller.getState()).toBe('listening');

    const out = controller.update(0.016, 0);
    expect(out.state).toBe('listening');
    expect(out.lipSync.aa).toBe(0);
    expect(out.lipSync.oh).toBe(0);
  });

  // Test Case 4: Teaching Move to Expression Mapping
  it('4. maps teaching moves and verdicts to expressions per SPEC.md rules', () => {
    expect(mapMoveToExpression('encourage')).toBe('smile');
    expect(mapMoveToExpression('worked_example')).toBe('focused');
    expect(mapMoveToExpression('hint_1')).toBe('raised_brows');
    expect(mapMoveToExpression('hint_2')).toBe('raised_brows');
    expect(mapMoveToExpression('hint_3')).toBe('raised_brows');
    expect(mapMoveToExpression('socratic_question')).toBe('raised_brows');
    expect(mapMoveToExpression(null, 'wrong')).toBe('concerned');
    expect(mapMoveToExpression(null, 'correct')).toBe('celebrate');
    expect(mapMoveToExpression('advance')).toBe('celebrate');
    expect(mapMoveToExpression('explain')).toBe('neutral');

    // Verify blend shape weights
    controller.setExpression('smile');
    let out = controller.update(0.016);
    expect(out.expressionWeights.happy).toBeGreaterThan(0.7);

    controller.setExpression('concerned');
    out = controller.update(0.016);
    expect(out.expressionWeights.sad).toBeGreaterThan(0.4);

    controller.setExpression('raised_brows');
    out = controller.update(0.016);
    expect(out.expressionWeights.surprised).toBeGreaterThan(0.5);
  });

  // Test Case 5: Audio-driven Lip Sync
  it('5. drives lip sync vowels from audio level and frequency data with smoothing', () => {
    controller.setState('speaking');

    // Speech with loudness
    const mockFrequencies = new Uint8Array(32);
    mockFrequencies[1] = 180; // Low frequency energy -> 'oh' / 'ou'
    mockFrequencies[2] = 200;
    mockFrequencies[4] = 140; // Mid -> 'ih'
    mockFrequencies[8] = 120; // High -> 'ee'

    // First frame of speech
    const out1 = controller.update(0.05, 0.7, mockFrequencies);
    expect(out1.lipSync.aa).toBeGreaterThan(0.1);
    expect(out1.lipSync.oh).toBeGreaterThan(0.05);

    // Subsequent frame smooths towards targets
    const out2 = controller.update(0.05, 0.7, mockFrequencies);
    expect(out2.lipSync.aa).toBeGreaterThanOrEqual(out1.lipSync.aa);

    // Audio stops -> mouth smoothly closes towards 0
    const out3 = controller.update(0.2, 0);
    expect(out3.lipSync.aa).toBeLessThan(out2.lipSync.aa);
  });

  // Test Case 6: Reduced Motion & Periodic Blinking
  it('6. respects prefers-reduced-motion and triggers periodic blinking', () => {
    const normalController = new AvatarController(false);
    normalController.setState('speaking');
    const normalOut = normalController.update(0.1, 0.5);

    const reducedController = new AvatarController(true);
    reducedController.setState('speaking');
    const reducedOut = reducedController.update(0.1, 0.5);

    // Reduced motion dampens gesture and spine pitch
    expect(reducedController.isReducedMotion()).toBe(true);
    expect(Math.abs(reducedOut.pose.spine.x)).toBeLessThan(Math.abs(normalOut.pose.spine.x) + 0.001);

    // Fast-forward time to verify blinking triggers within 3 to 6s
    let blinkOccurred = false;
    for (let t = 0; t < 7.0; t += 0.05) {
      const u = normalController.update(0.05, 0);
      if (u.blink > 0.01) {
        blinkOccurred = true;
        break;
      }
    }
    expect(blinkOccurred).toBe(true);
  });
});
