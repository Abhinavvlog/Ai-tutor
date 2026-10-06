import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const apiKey = env.GEMINI_API_KEY;

async function testTTS(model: string, voiceName: string, text: string) {
  console.log(`\nTesting TTS Model: ${model} Voice: ${voiceName}`);
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName
              }
            }
          }
        }
      })
    });

    console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
    const data = await res.json();
    if (!res.ok) {
      console.log('Error:', JSON.stringify(data, null, 2));
      return null;
    }

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (inlineData) {
      console.log(`Success! mimeType: ${inlineData.mimeType}, data length: ${inlineData.data?.length}`);
      return inlineData;
    } else {
      console.log('No inlineData found:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (err: any) {
    console.error('Fetch error:', err.message);
    return null;
  }
}

async function run() {
  await testTTS('gemini-3.1-flash-tts-preview', 'Kore', 'Hello! Welcome to MyGuru.');
  await testTTS('gemini-3.1-flash-tts-preview', 'Aoede', 'नमस्ते! आपका MyGuru में स्वागत है।');
}

run();
