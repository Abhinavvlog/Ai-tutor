import sys

file_path = "supabase/functions/tutor-turn/index.ts"
with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# Add import
if "GoogleGenAI" not in code:
    code = code.replace(
        "import { z } from 'npm:zod@3.22.4'",
        "import { z } from 'npm:zod@3.22.4'\nimport { GoogleGenAI } from 'npm:@google/genai@2.27.0'"
    )

# Add ai initialization
if "const ai = new GoogleGenAI" not in code:
    code = code.replace(
        "const apiKey = Deno.env.get('GEMINI_API_KEY')",
        "const apiKey = Deno.env.get('GEMINI_API_KEY')\n    const ai = new GoogleGenAI({ apiKey });"
    )

# Replace embed logic
import re

embed_old = re.compile(r"let embedPromise = Promise\.resolve\(\{ ok: true, json: .*?\}\);[\s\S]*?\}", re.MULTILINE)
embed_new = r"""let embedPromise = Promise.resolve({ values: [] });
          if (message) {
            embedPromise = ai.models.embedContent({
              model: embedModel,
              contents: message,
            }).then(res => ({ values: res.embeddings?.[0]?.values || [] }))
              .catch(err => {
                console.error("Embedding error:", err);
                return { values: [] };
              });
          }"""
code = embed_old.sub(embed_new.replace("\\", "\\\\"), code, count=1)

embed_res_old = re.compile(r"const embedRes = await embedPromise;\s*if \(!embedRes\.ok\) throw new Error\(\"Embedding failed\"\);\s*const embedJson = await embedRes\.json\(\);\s*const queryEmbedding = embedJson\.embedding\?\.values;", re.MULTILINE)
embed_res_new = """const embedRes = await embedPromise;
          const queryEmbedding = embedRes.values;"""
code = embed_res_old.sub(embed_res_new.replace("\\", "\\\\"), code, count=1)

# Replace generation logic
start_marker = "          let activeGenModel = defaultGenModel;"
end_marker = "          // Parse board XML tags"

start_idx = code.find(start_marker)
end_idx = code.find(end_marker)

if start_idx != -1 and end_idx != -1:
    gen_new = """          let activeGenModel = defaultGenModel;
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
              console.warn(`[Diagnostic] reqId=${session_id} Primary model ${activeGenModel} failed. Falling back to gemini-3.5-flash-lite.`);
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
          }

          if (sentenceBuffer.trim()) {
            sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() });
          }

"""
    code = code[:start_idx] + gen_new + code[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Migration complete")
