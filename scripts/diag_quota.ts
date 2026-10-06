import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
const apiKey = env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('No GEMINI_API_KEY found in .env');
  process.exit(1);
}

async function testEndpoint(name: string, url: string, payload: any) {
  console.log(`\n=== Testing ${name} ===`);
  const start = Date.now();
  try {
    const res = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const elapsed = Date.now() - start;
    console.log(`Status: ${res.status} ${res.statusText} (${elapsed}ms)`);
    console.log('Headers:');
    res.headers.forEach((val, key) => {
      if (key.includes('ratelimit') || key.includes('retry') || key.includes('quota') || key.includes('date')) {
        console.log(`  ${key}: ${val}`);
      }
    });

    const data = await res.json();
    if (!res.ok) {
      console.log('Error Body:', JSON.stringify(data, null, 2));
    } else {
      console.log('Success! Keys:', Object.keys(data));
      if (data.embedding) {
        console.log('Embedding values length:', data.embedding.values?.length);
      }
      if (data.candidates) {
        console.log('Candidates length:', data.candidates.length);
        console.log('Sample text:', data.candidates[0]?.content?.parts?.[0]?.text?.slice(0, 100));
      }
    }
  } catch (err: any) {
    console.error(`Fetch exception for ${name}:`, err.message);
  }
}

async function run() {
  // Test embedding
  await testEndpoint(
    'Embedding (gemini-embedding-001)',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    {
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text: 'what is an array' }] },
      outputDimensionality: 768
    }
  );

  // Test gemini-3.1-flash-lite streaming
  await testEndpoint(
    'Streaming Generation (gemini-3.1-flash-lite)',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent',
    {
      contents: [{ parts: [{ text: 'Explain array aur queue mai kya difference hai in Hinglish briefly.' }] }]
    }
  );

  // Test gemini-2.5-flash generateContent (check if it exists or deprecated)
  await testEndpoint(
    'Generation (gemini-2.5-flash)',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      contents: [{ parts: [{ text: 'Hello, in 10 words, what is an array?' }] }]
    }
  );

  // Test gemini-3.5-flash-lite generateContent
  await testEndpoint(
    'Generation (gemini-3.5-flash-lite)',
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    {
      contents: [{ parts: [{ text: 'Hello, in 10 words, what is an array?' }] }]
    }
  );
}

run();
