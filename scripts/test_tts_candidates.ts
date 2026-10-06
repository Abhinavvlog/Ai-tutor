import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const apiKey = env.GEMINI_API_KEY;

const ttsModels = [
  'gemini-3.8-flash-lite-tts',
  'gemini-3.8-flash-tts',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
];

async function testTTS(model: string) {
  console.log(`\n=== Testing ${model} ===`);
  const start = Date.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Hello, welcome to MyGuru!' }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore"
              }
            }
          }
        }
      })
    });
    console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`);
    const data = await res.json();
    if (res.ok) {
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      console.log(`SUCCESS on ${model}! inlineData length: ${inlineData?.data?.length}, mimeType: ${inlineData?.mimeType}`);
      return true;
    } else {
      console.log(`Failed on ${model}:`, data.error?.message?.slice(0, 200));
    }
  } catch (err: any) {
    console.error(`Error on ${model}:`, err.message);
  }
  return false;
}

async function run() {
  for (const m of ttsModels) {
    const ok = await testTTS(m);
    if (ok) {
      console.log(`\n>>> WINNER TTS MODEL: ${m} <<<`);
      break;
    }
  }
}

run();
