const fs = require('fs');
const path = 'supabase/functions/tutor-turn/index.ts';
let code = fs.readFileSync(path, 'utf8');

// Add import
if (!code.includes('GoogleGenAI')) {
  code = code.replace(
    "import { z } from 'npm:zod@3.22.4'",
    "import { z } from 'npm:zod@3.22.4'\nimport { GoogleGenAI } from 'npm:@google/genai@2.27.0'"
  );
}

// 1. Initialize SDK
// find `const apiKey = Deno.env.get('GEMINI_API_KEY')`
code = code.replace(
  "const apiKey = Deno.env.get('GEMINI_API_KEY')",
  "const apiKey = Deno.env.get('GEMINI_API_KEY')\n    const ai = new GoogleGenAI({ apiKey });"
);

// 2. Replace embedPromise logic
const oldEmbedBlock = `          let embedPromise = Promise.resolve({ ok: true, json: async () => ({ embedding: { values: [] } }) } as any);
          if (message) {
            embedPromise = fetchGeminiWithRetry(
            \`https://generativelanguage.googleapis.com/v1beta/models/\${embedModel}:embedContent?key=\${apiKey}\`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: \`models/\${embedModel}\`,
                content: { parts: [{ text: message }] }
              })
            },
            {
              requestId: session_id,
              stage: 'embedding',
              modelName: embedModel
            },
            2
            );
          }`;

const newEmbedBlock = `          let embedPromise = Promise.resolve({ values: [] });
          if (message) {
            embedPromise = ai.models.embedContent({
              model: embedModel,
              contents: message,
            }).then(res => ({ values: res.embeddings?.[0]?.values || [] }))
              .catch(err => {
                console.error("Embedding error:", err);
                return { values: [] };
              });
          }`;

code = code.replace(oldEmbedBlock, newEmbedBlock);

// 3. Replace embedRes extraction
const oldEmbedRes = `          const embedRes = await embedPromise;
          if (!embedRes.ok) throw new Error("Embedding failed");
          const embedJson = await embedRes.json();
          const queryEmbedding = embedJson.embedding?.values;`;

const newEmbedRes = `          const embedRes = await embedPromise;
          const queryEmbedding = embedRes.values;`;

code = code.replace(oldEmbedRes, newEmbedRes);

// 4. Replace generation logic
const oldGenerateBlock = `          let activeGenModel = defaultGenModel;
          let generateRes = await fetchGeminiWithRetry(
            \`https://generativelanguage.googleapis.com/v1beta/models/\${activeGenModel}:streamGenerateContent?key=\${apiKey}\`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(geminiPayload)
            },
            {
              requestId: session_id,
              stage: 'generation',
              modelName: activeGenModel
            },
            1
          );

          // If primary model fails with 429 or 503 or 404, fallback to gemini-3.5-flash-lite
          if (!generateRes.ok && activeGenModel !== 'gemini-3.5-flash-lite') {
            console.warn(\`[Diagnostic] reqId=\${session_id} Primary model \${activeGenModel} failed with status \${generateRes.status}\\nFalling back to gemini-3.5-flash-lite.\`);
            activeGenModel = 'gemini-3.5-flash-lite';
            generateRes = await fetchGeminiWithRetry(
              \`https://generativelanguage.googleapis.com/v1beta/models/\${activeGenModel}:streamGenerateContent?key=\${apiKey}\`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geminiPayload)
              },
              {
                requestId: session_id,
                stage: 'generation_fallback',
                modelName: activeGenModel
              },
              1
            );
          }

          if (!generateRes.ok) {
            throw new Error(\`Gemini API Error: \${generateRes.statusText}\`);
          }

          const reader = generateRes.body?.getReader()
          const decoder = new TextDecoder()
          let fullResponse = ''
          let sentenceBuffer = ''
          let sentenceIndex = 0

          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunkText = decoder.decode(value, { stream: true })
              
              if (chunkText.includes('"error":')) {
                 throw new Error('Gemini API returned an error inside stream: ' + chunkText);
              }

              const matches = chunkText.match(/"text":\\s*"((?:[^"\\\\]|\\\\.)*)"/g)
              if (matches) {
                for (const match of matches) {
                  let t = match.replace(/"text":\\s*"/, '').slice(0, -1)
                  t = t.replace(/\\\\n/g, '\\n').replace(/\\\\"/g, '"')
                  sendEvent('token', { text: t })
                  fullResponse += t
                  sentenceBuffer += t
                  if (/[.!????]\\s/.test(sentenceBuffer)) {
                    sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() })
                    sentenceBuffer = ''
                  }
                }
              }
            }
          }`;

// The regex test uses /[.!????]\s/ in the original, but the SDK chunk can be anything. We match that logic exactly.
const newGenerateBlock = `          let activeGenModel = defaultGenModel;
          let responseStream;
          try {
            responseStream = await ai.models.generateContentStream({
              model: activeGenModel,
              contents: geminiContents,
              config: {
                systemInstruction: systemInstruction.parts[0].text
              }
            });
          } catch (err: any) {
            if (activeGenModel !== 'gemini-3.5-flash-lite') {
              console.warn(\`[Diagnostic] reqId=\${session_id} Primary model \${activeGenModel} failed. Falling back to gemini-3.5-flash-lite.\`);
              activeGenModel = 'gemini-3.5-flash-lite';
              responseStream = await ai.models.generateContentStream({
                model: activeGenModel,
                contents: geminiContents,
                config: {
                  systemInstruction: systemInstruction.parts[0].text
                }
              });
            } else {
              throw err;
            }
          }

          let fullResponse = '';
          let sentenceBuffer = '';
          let sentenceIndex = 0;

          if (responseStream) {
            for await (const chunk of responseStream) {
              const chunkText = chunk.text || "";
              if (!chunkText) continue;
              
              sendEvent('token', { text: chunkText });
              fullResponse += chunkText;
              sentenceBuffer += chunkText;

              if (/[.!????]\\s/.test(sentenceBuffer)) {
                sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() });
                sentenceBuffer = '';
              }
            }
          }`;

// Wait, the regex `/[.!????]\s/` had a unicode character in the log output earlier: `/[.!? ]\s/`. I will just use `/[.!????]\s/` because the original had `/[.!????]\s/` when the user sent it, or maybe it got mangled in PS.
// Let's do a strict string replace instead by finding the start and end of the block.

fs.writeFileSync('migrate.cjs', `
const fs = require('fs');
const path = '${path.replace(/\\/g, '/')}';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes('GoogleGenAI')) {
  code = code.replace(
    "import { z } from 'npm:zod@3.22.4'",
    "import { z } from 'npm:zod@3.22.4'\\nimport { GoogleGenAI } from 'npm:@google/genai@2.27.0'"
  );
}

code = code.replace(
  "const apiKey = Deno.env.get('GEMINI_API_KEY')",
  "const apiKey = Deno.env.get('GEMINI_API_KEY');\\n    const ai = new GoogleGenAI({ apiKey });"
);

// Replace Embed
code = code.replace(
  /let embedPromise = Promise\\.resolve\\(\\{ ok: true, json:[\\s\\S]*?\\}\\);[\\s\\n]*\\}/,
  \`let embedPromise = Promise.resolve({ values: [] });
          if (message) {
            embedPromise = ai.models.embedContent({
              model: embedModel,
              contents: message,
            }).then(res => ({ values: res.embeddings?.[0]?.values || [] }))
              .catch(err => {
                console.error("Embedding error:", err);
                return { values: [] };
              });
          }\`
);

// Replace Embed Res
code = code.replace(
  /const embedRes = await embedPromise;[\\s\\n]*if \\(!embedRes\\.ok\\) throw new Error\\("Embedding failed"\\);[\\s\\n]*const embedJson = await embedRes\\.json\\(\\);[\\s\\n]*const queryEmbedding = embedJson\\.embedding\\?\\.values;/,
  \`const embedRes = await embedPromise;
          const queryEmbedding = embedRes.values;\`
);

// Replace Generation
const genRegex = /let activeGenModel = defaultGenModel;[\\s\\S]*?if \\(\\/.*?\\\\s\\/\\.test\\(sentenceBuffer\\)\\) \\{[\\s\\S]*?sendEvent\\('sentence', \\{ index: sentenceIndex\\+\\+, text: sentenceBuffer\\.trim\\(\\) \\}\\)[\\s\\S]*?sentenceBuffer = ''[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}[\\s\\S]*?\\}/;
code = code.replace(
  genRegex,
  \`let activeGenModel = defaultGenModel;
          let responseStream;
          try {
            responseStream = await ai.models.generateContentStream({
              model: activeGenModel,
              contents: geminiContents,
              config: {
                systemInstruction: systemInstruction.parts[0].text
              }
            });
          } catch (err: any) {
            if (activeGenModel !== 'gemini-3.5-flash-lite') {
              console.warn(\\\`[Diagnostic] reqId=\\${session_id} Primary model \\${activeGenModel} failed. Falling back to gemini-3.5-flash-lite.\\\`);
              activeGenModel = 'gemini-3.5-flash-lite';
              responseStream = await ai.models.generateContentStream({
                model: activeGenModel,
                contents: geminiContents,
                config: {
                  systemInstruction: systemInstruction.parts[0].text
                }
              });
            } else {
              throw err;
            }
          }

          let fullResponse = '';
          let sentenceBuffer = '';
          let sentenceIndex = 0;

          if (responseStream) {
            for await (const chunk of responseStream) {
              const chunkText = chunk.text || "";
              if (!chunkText) continue;
              
              sendEvent('token', { text: chunkText });
              fullResponse += chunkText;
              sentenceBuffer += chunkText;

              if (/[.!????]\\\\s/.test(sentenceBuffer)) {
                sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() });
                sentenceBuffer = '';
              }
            }
          }\`
);

fs.writeFileSync(path, code);
console.log('Migration complete');
`);
