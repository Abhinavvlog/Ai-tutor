import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const apiKey = env.GEMINI_API_KEY;

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (data.models) {
    console.log('Available models:');
    for (const m of data.models) {
      if (m.name.includes('tts') || m.name.includes('flash') || m.name.includes('audio') || m.supportedGenerationMethods?.includes('generateContent')) {
        console.log(`- ${m.name} (methods: ${m.supportedGenerationMethods?.join(', ')})`);
      }
    }
  } else {
    console.log('Error:', data);
  }
}

listModels();
