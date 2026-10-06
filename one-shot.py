import re

file_path = "supabase/functions/tutor-turn/index.ts"

with open(r'c:\Users\Shrijana\Downloads\MyGuru\tutor-turn-original.ts', 'r', encoding='utf-16le') as f:
    code = f.read()

# Just replace the specific regex corruptions manually safely.
# Find instances of [.!?...]s| and replace with ?
code = re.sub(r'\[\.\!\?[^\]]*?\]s\|(\r?\n)*', ' ? ', code)
code = code.replace("4 ? BREVITY", "4. BREVITY")
code = code.replace("e.g ? 503, 502)", "e.g. 503, 502)")
code = code.replace("e.g ? \"Let's", "e.g. \"Let's")
code = code.replace("from your course material ? ", "from your course material. ")
code = code.replace("sentences ? Clear up", "sentences. Clear up")
code = code.replace("beginning ? Continue forward", "beginning. Continue forward")
code = code.replace("speaks Hindi ? You MUST", "speaks Hindi. You MUST")
code = code.replace("Hindi ? \"", "Hindi. \"")
code = code.replace("concept (e.g ? ", "concept (e.g. ")
code = code.replace("greeted you ? \"", "greeted you. \"")
code = code.replace("engaging ? End with", "engaging. End with")
code = code.replace("explaining ? Use markdown", "explaining. Use markdown")
code = code.replace("math/code ? Do not reveal", "math/code. Do not reveal")
code = code.replace("request ? ", "request.")

# Revert broken else if block (Lines 455-460)
code = re.sub(r'\} else \{\s+langInstruction = "CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in English.*?\}\s+else if \(userLang === \'hi\'\) \{\s+langInstruction = "CRITICAL LANGUAGE: The student speaks Hindi.*?\}', 
              r'} else {\n             langInstruction = "CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in English. Do NOT switch to Hinglish or Hindi, even if the student asks a question in Hindi or Hinglish. Your output language MUST remain strict English unless explicitly told to switch languages by the user.";\n          }', code, flags=re.DOTALL)

# Add SDK
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

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)
