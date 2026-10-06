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

async function testTTS(name, text, voiceName, model = 'gemini-3.8-flash-tts') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    })
  });

  console.log(`[${name}] Voice: ${voiceName}, Status: ${res.status}`);
  if (res.ok) {
    const data = await res.json();
    const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (b64) {
      writeWav(`${name}.wav`, b64);
      console.log(`[${name}] SUCCESS saved ${name}.wav (${b64.length} chars)`);
    }
  } else {
    console.log(`[${name}] FAILED:`, await res.text());
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('1. Testing English with Kore:');
  await testTTS('test_eng_kore', 'Today we are going to learn about arrays. An array stores elements in contiguous memory.', 'Kore');

  await sleep(2000);

  console.log('2. Testing Pure Hindi (Devanagari) with Kore vs Aoede:');
  await testTTS('test_hi_kore', 'आज हम Arrays के बारे में सीखेंगे। Array में elements को index के माध्यम से access किया जाता है।', 'Kore');
  await sleep(2000);
  await testTTS('test_hi_aoede', 'आज हम Arrays के बारे में सीखेंगे। Array में elements को index के माध्यम से access किया जाता है।', 'Aoede');

  await sleep(2000);

  console.log('3. Testing Hinglish in Romanized vs Devanagari with English terms:');
  await testTTS('test_hinglish_roman_kore', 'Aaj hum arrays ke baare mein seekhenge. Array mein elements ko index ke through access karte hain.', 'Kore');
  await sleep(2000);
  await testTTS('test_hinglish_mixed_kore', 'आज हम Arrays के बारे में सीखेंगे। Array में elements को index के through access करते हैं।', 'Kore');
  await sleep(2000);
  await testTTS('test_hinglish_mixed_aoede', 'आज हम Arrays के बारे में सीखेंगे। Array में elements को index के through access करते हैं।', 'Aoede');
}

main();
