import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const apiKey = env.GEMINI_API_KEY;

const models = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.0-flash-lite'
];

async function test(model: string) {
  console.log(`\nTesting ${model}...`);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Hello student, welcome to MyGuru!' }]
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
    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (res.ok) {
      const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      console.log(`SUCCESS on ${model}! data length: ${inlineData?.data?.length}`);
      return true;
    } else {
      console.log(`Failed on ${model}:`, data.error?.message?.slice(0, 150));
    }
  } catch (e: any) {
    console.log(`Exception on ${model}:`, e.message);
  }
  return false;
}

async function run() {
  for (const m of models) {
    const ok = await test(m);
    if (ok) break;
  }
}

run();
