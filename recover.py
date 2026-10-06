import re
import os

log_path = r"C:\Users\Shrijana\.gemini\antigravity\brain\bd55da0e-f27a-4bda-8998-5cb3fadcf03d\.system_generated\tasks\task-5193.log"
with open(log_path, 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = 'import "jsr:@supabase/functions-js/edge-runtime.d.ts"'
end_marker = '})'

start = text.find(start_marker)
end = text.rfind(end_marker) + len(end_marker)

code = text[start:end] + '\n'

# Fix the truncations
code = re.sub(r'\[\.!\?\xef\xbf\xbd a\?,\]s\|(\r?\n)*', ' ? ', code)
code = re.sub(r'\[\.!\?\?\?\?\?\?\?\]s\|(\r?\n)*', ' ? ', code)
code = re.sub(r'\[\.!\?\xef\xbf\xbd \]s\|(\r?\n)*', ' ? ', code)
code = re.sub(r'\[\.!\?[\s\S]{0,10}?\]s\|(\r?\n)*', ' ? ', code)
code = code.replace("4 ? BREVITY & PEDAGOGY:", "4. BREVITY & PEDAGOGY:")
code = code.replace("e.g ? 503", "e.g. 503")
code = code.replace("e.g ? \"Let's start", "e.g. \"Let's start")
code = code.replace("from your course material ? ", "from your course material.\"\n")
code = code.replace("sentences ? Clear up", "sentences. Clear up")
code = code.replace("beginning ? Continue forward", "beginning. Continue forward")
code = code.replace("speaks Hindi ? You MUST", "speaks Hindi.\nYou MUST")
code = code.replace("Hindi ? \"", "Hindi.\"\n")
code = code.replace("concept (e.g ? ", "concept (e.g. ")
code = code.replace("greeted you ? \"", "greeted you.\"\n")
code = code.replace("engaging ? End with", "engaging. End with")
code = code.replace("explaining ? Use markdown", "explaining. Use markdown")
code = code.replace("math/code ? Do not reveal", "math/code. Do not reveal")
code = code.replace("with that kind of request ? ", "with that kind of request.\"")

# Also perform SDK rewrite
if "GoogleGenAI" not in code:
    code = code.replace(
        "import { z } from 'npm:zod@3.22.4'",
        "import { z } from 'npm:zod@3.22.4'\nimport { GoogleGenAI } from 'npm:@google/genai@2.27.0'"
    )

code = code.replace(
    "const apiKey = Deno.env.get('GEMINI_API_KEY')",
    "const apiKey = Deno.env.get('GEMINI_API_KEY')\n    const ai = new GoogleGenAI({ apiKey });"
)

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
code = embed_old.sub(embed_new, code, count=1)

embed_res_old = re.compile(r"const embedRes = await embedPromise;\s*if \(!embedRes\.ok\) throw new Error\(\"Embedding failed\"\);\s*const embedJson = await embedRes\.json\(\);\s*const queryEmbedding = embedJson\.embedding\?\.values;", re.MULTILINE)
embed_res_new = """const embedRes = await embedPromise;
          const queryEmbedding = embedRes.values;"""
code = embed_res_old.sub(embed_res_new, code, count=1)

# Generate Logic Replacement
start_idx = code.find("let activeGenModel = defaultGenModel;")
end_idx = code.find("// Parse board XML tags")

if start_idx != -1 and end_idx != -1:
    gen_new = """let activeGenModel = defaultGenModel;
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

with open(r'c:\Users\Shrijana\Downloads\MyGuru\supabase\functions\tutor-turn\index.ts', 'w', encoding='utf-8') as f:
    f.write(code)

print("Recovered and Migrated!")
