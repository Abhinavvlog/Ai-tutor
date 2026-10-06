import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const apiKey = (env.match(/VITE_GEMINI_API_KEY=(.*)/) || env.match(/GEMINI_API_KEY=(.*)/))[1].trim();

async function testTTS(text, voiceName, filename) {
  const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      parts: [{ text }]
    }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName
          }
        }
      }
    }
  };

  const res = await fetch(ttsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log(`[${voiceName}] Status: ${res.status}`);
  if (!res.ok) {
    console.log(await res.text());
    return;
  }
  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  if (part?.inlineData) {
    const buf = Buffer.from(part.inlineData.data, 'base64');
    fs.writeFileSync(filename, buf);
    console.log(`Saved ${filename} (${buf.length} bytes)`);
  } else {
    console.log('No audio:', part);
  }
}

async function main() {
  console.log('--- TEST 1: instruction wrapped text ---');
  await testTTS('You are a female teacher. Text:\n"Array mein hum elements ko index ke through access karte hain."', 'Kore', 'test_wrapped.pcm');

  console.log('--- TEST 2: direct Hinglish text ---');
  await testTTS('Array mein hum elements ko index ke through access karte hain.', 'Kore', 'test_direct_kore.pcm');

  console.log('--- TEST 3: test other voices with Hinglish ---');
  await testTTS('Array mein hum elements ko index ke through access karte hain.', 'Aoede', 'test_direct_aoede.pcm');
  await testTTS('Array mein hum elements ko index ke through access karte hain.', 'Puck', 'test_direct_puck.pcm');
  await testTTS('Array mein hum elements ko index ke through access karte hain.', 'Fenrir', 'test_direct_fenrir.pcm');
}

main();
