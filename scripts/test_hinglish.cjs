const { loadEnv } = require('vite');
const env = loadEnv('', process.cwd(), '');
async function test() {
  const prompt = `You are MyGuru AI Teacher. The student said: "array aur queue mai kya difference hai?".
  Use this course context:
  [Intro to Arrays, p.1] An array is a data structure...
  
  Pedagogy directive: explain.
  Keep it under 5 sentences. End with a guiding question if explaining. Use markdown for math/code. Do not reveal the exact answer unless it is a worked example.`;
  
  const generateRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=' + env.GEMINI_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    })
  });
  const data = await generateRes.json();
  console.log(data.candidates[0].content.parts[0].text);
}
test();
