import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const apiKey = (env.match(/VITE_GEMINI_API_KEY=(.*)/) || env.match(/GEMINI_API_KEY=(.*)/))[1].trim();

function writeWav(filename, pcmBase64, sampleRate = 24000) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const wavHeader = Buffer.alloc(44);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const chunkSize = 36 + dataSize;

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(chunkSize, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filename, Buffer.concat([wavHeader, pcm]));
}

async function testSpeech(testName, text, systemPrompt, voiceName, model = 'gemini-3.5-flash') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: systemPrompt ? {
      parts: [{ text: systemPrompt }]
    } : undefined,
    contents: [{
      parts: [{ text: `Read the following text aloud verbatim with natural cadence without adding any extra commentary:\n"${text}"` }]
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log(`[${testName}] Model: ${model}, Voice: ${voiceName}, Status: ${res.status}`);
  if (res.ok) {
    const data = await res.json();
    const cand = data.candidates?.[0]?.content?.parts?.[0];
    if (cand?.inlineData?.data) {
      writeWav(`${testName}.wav`, cand.inlineData.data);
      console.log(`[${testName}] SUCCESS! Saved ${testName}.wav (${cand.inlineData.data.length} base64 chars)`);
    } else {
      console.log(`[${testName}] Got parts:`, JSON.stringify(data.candidates?.[0]?.content?.parts));
    }
  } else {
    console.log(`[${testName}] FAILED:`, await res.text());
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('--- TEST 1: English (Kore) ---');
  await testSpeech(
    'test1_english',
    'Today we are going to learn about arrays. An array stores elements in contiguous memory.',
    'You are a clear, articulate female computer science teacher. Speak in fluent, natural English with standard pronunciation and engaging delivery.',
    'Kore'
  );

  await sleep(1500);

  console.log('--- TEST 2: Hindi (Aoede) ---');
  await testSpeech(
    'test2_hindi',
    'आज हम Arrays के बारे में सीखेंगे। Array में elements को index के माध्यम से access किया जाता है।',
    'You are an Indian female computer science teacher in India. Speak in authentic, fluent, and warm Hindi with natural Indian pronunciation and intonation, keeping English technical terms crisp and distinct.',
    'Aoede'
  );

  await sleep(1500);

  console.log('--- TEST 3: Hinglish (Aoede) ---');
  await testSpeech(
    'test3_hinglish',
    'Aaj hum arrays ke baare mein seekhenge. Array mein elements ko index ke through access karte hain.',
    'You are a friendly Indian female computer science teacher speaking naturally in Hinglish. Pronounce Hindi conversational words with authentic Indian Hindi phonetics, and pronounce English computer science technical terms (Arrays, elements, index, access) clearly.',
    'Aoede'
  );
}

main();
