import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { z } from 'npm:zod@3.22.4'
import { GoogleGenAI } from 'npm:@google/genai@2.27.0'
import { determineNextMove, PedagogyState } from './logic/pedagogy.ts'
import { updateMastery } from './logic/bkt.ts'
import { checkNumeric, checkMcq } from './logic/answer_checker.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const reqSchema = z.object({
  session_id: z.string().uuid(),
  concept_id: z.string().optional(),
  mode: z.enum(['chat', 'lesson_start', 'student_interruption']).default('chat'),
  message: z.string().optional().default(''),
  input_mode: z.enum(['text', 'voice']).default('text'),
  interrupted: z.boolean().default(false),
  interrupted_at: z.string().optional(),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
});

function logSafeDiagnostic(info: {
  requestId: string;
  stage: string;
  modelName: string;
  httpStatus: number | string;
  retryNumber: number;
  elapsedMs: number;
}) {
  console.log(
    `[Diagnostic] reqId=${info.requestId} stage=${info.stage} model=${info.modelName} status=${info.httpStatus} retry=${info.retryNumber} elapsedMs=${info.elapsedMs}`
  );
}

function buildGeminiContents(
  history: Array<{ role: 'user' | 'model', text: string }>,
  currentPrompt: string
): Array<{ role: 'user' | 'model', parts: [{ text: string }] }> {
  const contents: Array<{ role: 'user' | 'model', parts: [{ text: string }] }> = [];

  for (const item of history) {
    const text = item.text?.trim();
    if (!text) continue;
    const role = item.role === 'model' ?
'model' : 'user';

    // Gemini requires the conversation history to begin with a 'user' turn
    if (contents.length === 0 && role !== 'user') {
      continue;
    }

    // Merge consecutive messages of identical roles
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += `\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  // Append current prompt as the latest user turn
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += `\n\n${currentPrompt}`;
  } else {
    contents.push({ role: 'user', parts: [{ text: currentPrompt }] });
  }

  return contents;
}

async function fetchGeminiWithRetry(
  url: string,
  options: RequestInit,
  diagnosticInfo: {
    requestId: string;
    stage: string;
    modelName: string;
  },
  maxRetries = 2
): Promise<Response> {
  let attempt = 0;

  while (true) {
    const callStart = Date.now();
    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (fetchErr: any) {
      const elapsed = Date.now() - callStart;
      logSafeDiagnostic({
        requestId: diagnosticInfo.requestId,
        stage: diagnosticInfo.stage,
        modelName: diagnosticInfo.modelName,
        httpStatus: 'network_error',
        retryNumber: attempt,
        elapsedMs: elapsed,
      });
      if (attempt >= maxRetries) throw fetchErr;
      attempt++;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500 + Math.random() * 200));
      continue;
    }

    const elapsed = Date.now() - callStart;
    logSafeDiagnostic({
      requestId: diagnosticInfo.requestId,
      stage: diagnosticInfo.stage,
      modelName: diagnosticInfo.modelName,
      httpStatus: res.status,
      retryNumber: attempt,
      elapsedMs: elapsed,
    });

    if (res.ok) {
      return res;
    }

    // Handle 429 Rate Limit
    if (res.status === 429) {
      if (attempt >= maxRetries) {
        return res;
      }

      // Check Retry-After header if provided
      const retryAfterHeader = res.headers.get('retry-after');
      let retryDelayMs = 0;
      if (retryAfterHeader) {
        const parsedSeconds = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsedSeconds)) {
          retryDelayMs = parsedSeconds * 1000;
        } else {
          const parsedDate = new Date(retryAfterHeader).getTime();
          if (!isNaN(parsedDate)) {
            retryDelayMs = Math.max(0, parsedDate - Date.now());
          }
        }
      }

      // If quota is exhausted or wait is long (> 10s), do not retry in a loop
      if (retryDelayMs > 10000) {
        return res;
      }

      attempt++;
      const backoff = retryDelayMs > 0
        [.!?à¥¤ã€‚]s|
retryDelayMs + Math.random() * 500
        : Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    // Handle 5xx Transient Server Errors (e.g[.!?à¥¤ã€‚]s|
503, 502)
    if (res.status >= 500 && res.status < 600) {
      if (attempt >= maxRetries) {
        return res;
      }
      attempt++;
      const backoff = Math.pow(2, attempt) * 500 + Math.random() * 200;
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    // Permanent 4xx errors (400, 401, 403, 404) return immediately
    return res;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?[.!?à¥¤ã€‚]s|
'',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?[.!?à¥¤ã€‚]s|
Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY') ?[.!?à¥¤ã€‚]s|
'',
    )

    // Verify auth
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const { session_id, concept_id, mode, message, input_mode, interrupted, interrupted_at, history: reqHistory } = reqSchema.parse(body)

    // Rate limiting (simple DB check: max 30 msgs per minute)
    const oneMinAgo = new Date(Date.now() - 60000).toISOString()
    const { count, error: rlError } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .eq('role', 'student')
      .gte('created_at', oneMinAgo)
    
    if (rlError) throw rlError;
    if (count !== null && count >= 30) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: corsHeaders })
    }

    // Moderation (basic regex)
    const blockedPatterns = [/ignore previous instructions/i, /reveal your prompt/i, /kill/i, /suicide/i, /fuck/i]
    if (message && blockedPatterns.some(p => p.test(message))) {
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder()
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'sentence', index: 0, text: "I'm sorry, I can't engage with that kind of request[.!?à¥¤ã€‚]s|
Let's get back to our lesson." })}\n\n`))
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
          controller.close()
        }
      })
      return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } })
    }

    // Implement stream logic
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        const sendEvent = (type: string, data: any) => {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`))
        }

        try {
          const apiKey = Deno.env.get('GEMINI_API_KEY')
    const ai = new GoogleGenAI({ apiKey });!
          const embedModel = Deno.env.get('GEMINI_EMBED_MODEL') || 'gemini-embedding-001'
          const envGenModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
          // Route legacy/deprecated models to fast, reliable gemini-3.5-flash-lite
          const defaultGenModel = (envGenModel === 'gemini-2.5-flash' || envGenModel === 'gemini-2.0-flash')
            [.!?à¥¤ã€‚]s|
'gemini-3.5-flash-lite'
            : envGenModel

          // 1[.!?à¥¤ã€‚]s|
Embedding generation in parallel with session, profile and history retrieval
          let embedPromise = Promise.resolve({ ok: true, json: async () => ({ embedding: { values: [] } }) } as any);
          if (message) {
            embedPromise = fetchGeminiWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: `models/${embedModel}`,
                content: { parts: [{ text: message }] },
                outputDimensionality: 768
              })
            },
            {
              requestId: session_id,
              stage: 'embedding',
              modelName: embedModel
            },
            2
            );
          }

          const sessionPromise = supabaseClient.from('sessions').select('*').eq('id', session_id).single();
          const profilePromise = supabaseClient.from('profiles').select('language, display_name').eq('id', user.id).single();
          const historyPromise = (!reqHistory || reqHistory.length === 0)
            ?
supabaseClient.from('messages').select('role, content, created_at').eq('session_id', session_id).order('created_at', { ascending: false }).limit(6)
            : Promise.resolve({ data: null });
          
          const [{ data: existingSession }, { data: profile }, embedRes, historyRes] = await Promise.all([
            sessionPromise,
            profilePromise,
            embedPromise,
            historyPromise,
          ]);

          let conversationHistory: Array<{ role: 'user' | 'model', text: string }> = [];
          if (reqHistory && reqHistory.length > 0) {
            conversationHistory = reqHistory.map((h: any) => ({
              role: (h.role === 'student' || h.role === 'user') [.!?à¥¤ã€‚]s|
'user' : 'model',
              text: h.content,
            }));
          } else if (historyRes?.data && historyRes.data.length > 0) {
            conversationHistory = historyRes.data.reverse().map((m: any) => ({
              role: (m.role === 'student' || m.role === 'user') [.!?à¥¤ã€‚]s|
'user' : 'model',
              text: m.content,
            }));
          }

function normalizeConceptId(id?: string): string {
  if (!id) return 'arrays_1';
  const clean = id.toLowerCase().replace(/-/g, '_').trim();
  if (['arrays', 'array', 'arrays_1', 'arrays1', 'intro_to_arrays', 'introduction_to_arrays'].includes(clean)) return 'arrays_1';
  if (['arrays_2', 'arrays2', 'array_operations', 'array_ops'].includes(clean)) return 'arrays_2';
  if (['linked_lists', 'linked_list', 'linkedlist', 'linkedlists', 'linked_lists_1', 'linked_lists1', 'singly_linked_lists'].includes(clean)) return 'linked_lists_1';
  if (['linked_lists_2', 'linked_lists2', 'doubly_linked_lists'].includes(clean)) return 'linked_lists_2';
  if (['stacks', 'stack', 'stacks_1', 'stacks1'].includes(clean)) return 'stacks_1';
  if (['queues', 'queue', 'queues_1', 'queues1'].includes(clean)) return 'queues_1';
  return clean;
}

          let session;
          if (existingSession) {
            session = existingSession;
          } else {
            const resolvedConceptId = normalizeConceptId(body.concept_id);
            const { data: newSession, error: createErr } = await supabaseClient
              .from('sessions')
              .insert({ id: session_id, student_id: user.id, concept_id: resolvedConceptId })
              .select().single();
            if (createErr) {
              console.error('Session creation error:', createErr);
              throw createErr;
            }
            session = newSession;
          }

          // Fetch mastery and question concurrently
          const masteryPromise = supabaseClient.from('mastery').select('*').eq('student_id', user.id).eq('concept_id', session.concept_id).single();
          const questionPromise = session.current_question_id 
            [.!?à¥¤ã€‚]s|
supabaseClient.from('question_bank').select('*').eq('id', session.current_question_id).single()
            : Promise.resolve({ data: null });

          const [{ data: masteryRow }, { data: q }] = await Promise.all([masteryPromise, questionPromise]);

          let mastery = masteryRow [.!?à¥¤ã€‚]s|
masteryRow.p_mastery : 0.3
          let correctStreak = masteryRow [.!?à¥¤ã€‚]s|
masteryRow.correct_streak : 0
          let difficulty = masteryRow [.!?à¥¤ã€‚]s|
masteryRow.difficulty : 'easy'

          // Deterministic intent check: if the student is asking a question, this is NOT an answer turn
          const isStudentQuestion = message.includes('?') || /\b(what|why|how|explain|difference|kya|kaise|kyu|kyun|batao|samjhao)\b/i.test(message);

          let isAnswerTurn = false;
          let question = null;
          if (q && !isStudentQuestion) {
            question = q;
            isAnswerTurn = true;
          }

          // 2[.!?à¥¤ã€‚]s|
Vector search retrieval / Direct curriculum fetch
          let chunks: any[] = [];

          if (mode === 'lesson_start' || !message.trim()) {
            // For lesson_start, immediately pull curriculum chunks directly without vector search delay
            const { data: defaultChunks } = await supabaseClient
              .from('content_chunks')
              .select('id, concept_id, source_title, page, text')
              .eq('concept_id', session.concept_id)
              .limit(3);
            chunks = defaultChunks || [];
          } else {
            if (!embedRes.ok) {
              throw new Error(`Gemini API Error (Embedding): ${embedRes.statusText}`);
            }
            const embedData = await embedRes.json();
            const query_embedding = embedData.embedding.values;

            let { data: matchedChunks, error: chunksErr } = await supabaseClient.rpc('match_content_chunks', {
              query_embedding: JSON.stringify(query_embedding),
              match_threshold: 0.50,
              match_count: 4,
              filter_concept_ids: [session.concept_id]
            });
            
            if (chunksErr) {
              console.error('RPC match_content_chunks error:', chunksErr);
            }

            chunks = matchedChunks || [];

            // If no chunks matched in the single concept, search across all course concepts
            if (chunks.length === 0) {
              const allCourseConcepts = ['arrays_1', 'arrays_2', 'queues_1', 'stacks_1', 'linked_lists_1', 'linked_lists_2'];
              const { data: crossChunks } = await supabaseClient.rpc('match_content_chunks', {
                query_embedding: JSON.stringify(query_embedding),
                match_threshold: 0.35,
                match_count: 4,
                filter_concept_ids: allCourseConcepts
              });
              if (crossChunks && crossChunks.length > 0) {
                chunks = crossChunks;
              }
            }

            // Baseline fallback: grab concept chunks so tutor stays grounded in curriculum
            if (chunks.length === 0) {
              const { data: defaultChunks } = await supabaseClient
                .from('content_chunks')
                .select('id, concept_id, source_title, page, text')
                .eq('concept_id', session.concept_id)
                .limit(2);
              if (defaultChunks && defaultChunks.length > 0) {
                chunks = defaultChunks;
              }
            }
          }

          if (!chunks || chunks.length === 0) {
            const fallbackMsg = "I'm not fully sure about this from your course material[.!?à¥¤ã€‚]s|
Please check your textbook or ask your teacher.";
            sendEvent('token', { text: fallbackMsg });
            sendEvent('sentence', { index: 0, text: fallbackMsg });
            sendEvent('done', {});
            controller.close();
            return;
          }

          let contextText = chunks.map((c: any) => `[${c.source_title}, p.${c.page}] ${c.text}`).join('\n\n')

          // 3[.!?à¥¤ã€‚]s|
Answer Checking (100% deterministic/local logic - no separate Gemini calls)
          let verdict: 'correct' | 'partial' | 'wrong' = 'wrong'
          if (isAnswerTurn && question) {
            if (question.type === 'numeric') {
              verdict = checkNumeric(message, question.answer) [.!?à¥¤ã€‚]s|
'correct' : 'wrong'
            } else if (question.type === 'mcq') {
              verdict = checkMcq(message, question.answer) [.!?à¥¤ã€‚]s|
'correct' : 'wrong'
            } else {
              // Deterministic keyword matching for short answers
              const normStudent = message.toLowerCase().trim()
              const normAnswer = (question.answer || '').toLowerCase().trim()
              if (normStudent === normAnswer || (normAnswer && normStudent.includes(normAnswer))) {
                verdict = 'correct'
              } else {
                verdict = 'partial'
              }
            }
          }

          // 4[.!?à¥¤ã€‚]s|
Pedagogy Move (100% deterministic local logic)
          const pedState: PedagogyState = {
            mastery,
            hintsUsed: session.hints_used,
            correctStreak,
            interruptions: session.interruptions,
            minutesOnConcept: (Date.now() - new Date(session.started_at).getTime()) / 60000,
            hasMisconception: false,
            currentDifficulty: difficulty as any,
            prereqsCleared: true,
          }
          const action = determineNextMove(pedState, isAnswerTurn, verdict)

          // Emit Meta
          sendEvent('meta', {
            move: action.move,
            concept_id: session.concept_id,
            expression: verdict === 'correct' [.!?à¥¤ã€‚]s|
'celebrate' : 'neutral',
            citations: chunks.map((c: any) => ({ source_title: c.source_title, page: c.page, chunk_id: c.id })),
            p_mastery: mastery
          })

          // 5[.!?à¥¤ã€‚]s|
Generate Response (exactly ONE generation request with conversational context)
                    const userLang = body.language || profile?.language || 'en';
          let langInstruction = '';
          if (userLang === 'hinglish') {
             langInstruction = "CRITICAL LANGUAGE INSTRUCTION: You MUST respond naturally in friendly Indian Hinglish (Hindi grammar written in Latin script). Do NOT switch back to English, even if the student speaks English. Keep all technical terms in standard English.";
          } else if (userLang === 'hi') {
             langInstruction = "CRITICAL LANGUAGE INSTRUCTION: You MUST respond naturally in Hindi. Do NOT switch to English, even if the student speaks English. Keep all technical terms in standard English.";
          } else {
             langInstruction = "CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in English. Do NOT switch to Hinglish or Hindi, even if the student asks a question in Hindi or Hinglish. Your output language MUST remain strict English unless explicitly told to switch languages by the user.";
          } else if (userLang === 'hi') {
             langInstruction = "CRITICAL LANGUAGE: The student speaks Hindi[.!?à¥¤ã€‚]s|
You MUST respond naturally in Hindi[.!?à¥¤ã€‚]s|
Keep all technical terms (Array, Queue, Stack, Linked List, index, pointer, node, FIFO, LIFO, etc.) in their standard English form.";
          }

          const isFirstTurn = conversationHistory.length === 0;
          const isExplicitGreeting = /^\s*(hi|hello|hey|namaste|pranam|good morning|good afternoon|good evening|salaam)\b/i.test(message.trim());

          let greetingGuidance = '';
          if (!isFirstTurn && !isExplicitGreeting) {
            greetingGuidance = `
CRITICAL CONVERSATIONAL RULE: This is an ongoing conversation (Turn ${conversationHistory.length + 1}).
- DO NOT say "Hello", "Hi", "Hey", or introduce yourself.
- Jump IMMEDIATELY and directly into the explanation or answer.
- Connect directly to the concept (e.g[.!?à¥¤ã€‚]s|
start directly with "Array aur queue dono..." or a quick pedagogical bridge like "Samajhte hain:").
`;
          } else if (isExplicitGreeting) {
            greetingGuidance = `
The student greeted you[.!?à¥¤ã€‚]s|
Greet them back warmly and briefly in 1 sentence, and ask what concept or question they want to learn today.
`;
          }

          let interruptionGuidance = '';
          if (mode === 'student_interruption' || interrupted) {
            interruptionGuidance = `
CLASSROOM INTERRUPTION DIRECTIVE:
- The student interrupted your explanation during the lesson!
- You were explaining: "${interrupted_at || 'the concept'}".
- Student asked / said: "${message}".
- STEP 1: Answer the student's specific doubt or question directly, clearly, and concisely in 1-2 sentences[.!?à¥¤ã€‚]s|
Clear up their doubt immediately.
- STEP 2: Transition smoothly (e.g., "Now, continuing with our lesson:" or "Chalo, aage dekhte hain:") and continue the lesson from where you stopped.
- CRITICAL: DO NOT restart the whole explanation from the beginning[.!?à¥¤ã€‚]s|
Continue forward with the next logical point.`;
          }

          let currentTurnPrompt = '';

          if (mode === 'lesson_start') {
            currentTurnPrompt = `CLASSROOM INSTRUCTION:
- You are beginning a new lesson on "${session.concept_id}".
- DO NOT wait for a question from the student.
- DO NOT say "Hello" or "Hi"[.!?à¥¤ã€‚]s|
Start teaching immediately.
- Begin naturally, e.g[.!?à¥¤ã€‚]s|
"Let's start with ${session.concept_id}..." or "Chalo, aaj ${session.concept_id} ke baare mein dekhte hain..."
- Explain the core idea simply in 2-3 sentences.
- End by asking a quick check-in question or inviting the student to ask a doubt.

Course Context:
${contextText}

${langInstruction}`;
          } else {
            currentTurnPrompt = `Student message: "${message}"

Course Context:
${contextText}

Pedagogy Directive: ${action.move}[.!?à¥¤ã€‚]s|
${action.specialInstruction || ''}
${langInstruction}
${greetingGuidance}
${interruptionGuidance}
Keep your answer clear, under 4-5 sentences, friendly, and engaging[.!?à¥¤ã€‚]s|
End with a guiding question if explaining[.!?à¥¤ã€‚]s|
Use markdown for math/code[.!?à¥¤ã€‚]s|
Do not reveal the exact answer unless it's a worked example.`;
          }

          const systemInstruction = {
            parts: [{
              text: `You are MyGuru, an encouraging, friendly, human-like AI computer science tutor teaching Indian students.

CORE CONVERSATIONAL BEHAVIOR:
1. GREETING DISCIPLINE:
   - Say "Hello" / "Hi" / "Namaste" ONLY on the first message of a brand-new session or when the student explicitly greets you first.
   - On follow-up questions, NEVER say "Hello", "Hi there", or re-introduce yourself.
   - Jump immediately and directly into the explanation or concept.

2. VOICE DICTATION TOLERANCE:
   - The student is talking to you using voice recognition. Sometimes the microphone picks up your own audio from their speakers, adding random words to the start or end of their sentence (e.g., "first what is an array" or "array is a list concept").
   - Ignore any random, out-of-context words at the beginning or end of their message. Focus entirely on the core question or intent.

3. CONVERSATIONAL CONTINUATION & MEMORY:
   - Maintain continuous conversation. Remember previous turns and concepts discussed.
   - When the student asks follow-ups like "iska use kahan hota hai?", "aur example do?", "queue se difference?", refer directly to the prior topic seamlessly.
   - Do NOT treat each message as an isolated new prompt.

4. LANGUAGE & VOCABULARY:
   - Natural Indian teacher style: warm, concise, clear, and direct.
   - If Hinglish is requested or spoken: reply in natural, authentic Hinglish (Hindi grammar in Latin script).
   - Technical terms (Array, Queue, Stack, Linked List, FIFO, LIFO, index, pointer, node, enqueue, dequeue, push, pop, time complexity, etc.) MUST ALWAYS be kept in English.

4[.!?à¥¤ã€‚]s|
BREVITY & PEDAGOGY:
   - Keep answers clear and concise (under 4-5 sentences).
   - If explaining, end with a brief guiding question to check understanding.
   - Format code and math using markdown.

5. BLACKBOARD USAGE:
   - You are standing in front of a real classroom blackboard.
   - You MUST physically write on the board when explaining data structures, math, or code.
   - Use these exact XML tags in your response to trigger board actions:
     <board_text>some text</board_text>
     <board_array>10, 20, 30, 40</board_array>
     <board_linked_list>10, 20, 30</board_linked_list>
     <board_stack>10, 20, 30</board_stack>
     <board_queue>10, 20, 30</board_queue>
     <board_code>const x = 10;</board_code>
     <board_erase></board_erase>
   - Example: "Arrays are contiguous memory blocks. <board_array>10, 20, 30</board_array> See how they are sequential?"
   - Do NOT use markdown code blocks (```) for board content anymore, ONLY use the XML tags above.`
            }]
          };

          const geminiContents = buildGeminiContents(conversationHistory, currentTurnPrompt);

          const geminiPayload = {
            systemInstruction,
            contents: geminiContents,
          };

          let activeGenModel = defaultGenModel;
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

              if (/[.!?\u0964\u3002]\s/.test(sentenceBuffer)) {
                sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() });
                sentenceBuffer = '';
              }
            }
          }

          if (sentenceBuffer.trim()) {
            sendEvent('sentence', { index: sentenceIndex++, text: sentenceBuffer.trim() });
          }

          // Parse board XML tags
          const boardTags = ['board_text', 'board_array', 'board_linked_list', 'board_stack', 'board_queue', 'board_code', 'board_erase'];
          boardTags.forEach(tag => {
            const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'g');
            let match;
            while ((match = regex.exec(fullResponse)) !== null) {
              sendEvent('board_action', { type: tag, content: match[1] });
            }
          });

          // 6[.!?à¥¤ã€‚]s|
Asynchronous DB updates
          if (isAnswerTurn) {
            const newM = updateMastery(mastery, verdict === 'correct')
            const newStreak = verdict === 'correct' [.!?à¥¤ã€‚]s|
correctStreak + 1 : 0
            
            await supabaseClient.from('mastery').upsert({
              student_id: user.id,
              concept_id: session.concept_id,
              p_mastery: newM,
              correct_streak: newStreak,
              difficulty: action.newDifficulty,
              updated_at: new Date().toISOString()
            })

            await supabaseClient.from('attempts').insert({
              student_id: user.id,
              session_id: session.id,
              concept_id: session.concept_id,
              question_id: question!.id,
              verdict,
              hints_used: session.hints_used,
              response_ms: 5000
            })
          }

          await supabaseClient.from('messages').insert([
            { session_id: session.id, role: 'student', content: message },
            { session_id: session.id, role: 'tutor', content: fullResponse, move: action.move }
          ])

          sendEvent('done', {})
          controller.close()
        } catch (err: any) {
          console.error(err)
          sendEvent('error', { message: err.message })
          controller.close()
        }
      }
    })

    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})
