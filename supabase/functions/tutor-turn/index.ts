import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { z } from 'npm:zod@3.22.4'
import { GoogleGenAI } from 'npm:@google/genai@2.27.0'
import { determineNextMove, PedagogyState } from './logic/pedagogy.ts'
import { updateMastery } from './logic/bkt.ts'
import { checkNumeric, checkMcq } from './logic/answer_checker.ts'
import { resolveResponseLanguage } from './logic/responseLanguage.ts'

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
  resume_lesson: z.boolean().default(false),
  resume_decision: z.enum(['continue', 'decline']).optional(),
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
?
retryDelayMs + Math.random() * 500
        : Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise(r => setTimeout(r, backoff));
      continue;
    }

    // Handle 5xx transient server errors (e.g., 503 or 502).
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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        ?? Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY')
        ?? '',
    )

    // Verify auth
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const {
      session_id,
      concept_id,
      mode,
      message,
      input_mode,
      interrupted,
      interrupted_at,
      resume_lesson,
      resume_decision,
      history: reqHistory,
    } = reqSchema.parse(body)
    const isQuickResponse = input_mode === 'voice' || mode === 'student_interruption' || resume_lesson

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
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'sentence', index: 0, text: "I'm sorry, I can't engage with that kind of request. Let's get back to our lesson." })}\n\n`))
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
          const apiKey = Deno.env.get('GEMINI_API_KEY');
          if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
          const ai = new GoogleGenAI({ apiKey });
          const embedModel = Deno.env.get('GEMINI_EMBED_MODEL') || 'gemini-embedding-001'
          const envGenModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
          // Route legacy/deprecated models to fast, reliable gemini-3.5-flash-lite
          const defaultGenModel = (envGenModel === 'gemini-2.5-flash' || envGenModel === 'gemini-2.0-flash')
            ?
'gemini-3.5-flash-lite'
            : envGenModel

          // Start embedding generation alongside session, profile, and history retrieval.
          let embedPromise = Promise.resolve({ ok: true, json: async () => ({ embedding: { values: [] } }) } as any);
          if (message && !isQuickResponse) {
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
              role: (h.role === 'student' || h.role === 'user')
                ?
'user' : 'model',
              text: h.content,
            }));
          } else if (historyRes?.data && historyRes.data.length > 0) {
            conversationHistory = historyRes.data.reverse().map((m: any) => ({
              role: (m.role === 'student' || m.role === 'user')
                ?
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
            ?
supabaseClient.from('question_bank').select('*').eq('id', session.current_question_id).single()
            : Promise.resolve({ data: null });

          const [{ data: masteryRow }, { data: q }] = await Promise.all([masteryPromise, questionPromise]);

          let mastery = masteryRow
            ?
masteryRow.p_mastery : 0.3
          let correctStreak = masteryRow
            ?
masteryRow.correct_streak : 0
          let difficulty = masteryRow
            ?
masteryRow.difficulty : 'easy'

          // Deterministic intent check: if the student is asking a question, this is NOT an answer turn
          const isStudentQuestion = message.includes('?') || /\b(what|why|how|explain|difference|kya|kaise|kyu|kyun|batao|samjhao)\b/i.test(message);

          let isAnswerTurn = false;
          let question = null;
          if (q && !isStudentQuestion) {
            question = q;
            isAnswerTurn = true;
          }

          // Retrieve relevant course material, with a direct curriculum fallback.
          let chunks: any[] = [];

          if (mode === 'lesson_start' || !message.trim() || isQuickResponse) {
            // Voice questions use direct concept context to avoid waiting for embedding and vector search.
            const { data: defaultChunks } = await supabaseClient
              .from('content_chunks')
              .select('id, concept_id, source_title, page, text')
              .eq('concept_id', session.concept_id)
              .limit(mode === 'lesson_start' ? 3 : 2);
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
            const fallbackMsg = "I'm not fully sure about this from your course material. Please check your textbook or ask your teacher.";
            sendEvent('token', { text: fallbackMsg });
            sendEvent('sentence', { index: 0, text: fallbackMsg });
            sendEvent('done', {});
            controller.close();
            return;
          }

          let contextText = chunks.map((c: any) => `[${c.source_title}, p.${c.page}] ${c.text}`).join('\n\n')

          // Answer checking is deterministic and does not require another Gemini call.
          let verdict: 'correct' | 'partial' | 'wrong' = 'wrong'
          if (isAnswerTurn && question) {
            if (question.type === 'numeric') {
              verdict = checkNumeric(message, question.answer)
                ?
'correct' : 'wrong'
            } else if (question.type === 'mcq') {
              verdict = checkMcq(message, question.answer)
                ?
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

          // Pedagogy selection is deterministic and does not require another Gemini call.
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
            expression: verdict === 'correct'
              ?
'celebrate' : 'neutral',
            citations: chunks.map((c: any) => ({ source_title: c.source_title, page: c.page, chunk_id: c.id })),
            p_mastery: mastery
          })

          // Generate one streamed response with conversation context.
          const userLang = body.language || profile?.language || 'en';
          const responseLanguage = resolveResponseLanguage(userLang, message);
          const langInstruction = responseLanguage === 'hinglish'
            ? 'Respond in natural, easy-to-understand Indian Hinglish using Hindi grammar in Latin script. Keep computer-science terms in English.'
            : responseLanguage === 'hi'
              ? 'Respond in clear, natural Hindi. Keep computer-science terms in English.'
              : 'Respond in clear, natural English.';

          const isFirstTurn = conversationHistory.length === 0;
          const isExplicitGreeting = /^\s*(hi|hello|hey|namaste|pranam|good morning|good afternoon|good evening|salaam)\b/i.test(message.trim());

          let greetingGuidance = '';
          if (!isFirstTurn && !isExplicitGreeting) {
            greetingGuidance = `
CRITICAL CONVERSATIONAL RULE: This is an ongoing conversation (Turn ${conversationHistory.length + 1}).
- DO NOT say "Hello", "Hi", "Hey", or introduce yourself.
- Jump IMMEDIATELY and directly into the explanation or answer.
- Connect directly to the concept, for example: "Array aur queue dono..." or "Samajhte hain:".
`;
          } else if (isExplicitGreeting) {
            greetingGuidance = `
The student greeted you. Greet them warmly in one brief sentence and ask what they want to learn.
`;
          }

          const isInterruption = mode === 'student_interruption' || interrupted;
          let interruptionGuidance = '';
          if (isInterruption) {
            interruptionGuidance = `
INTERRUPTION DIRECTIVE:
- The student stopped you to ask a new question about "${interrupted_at || 'the lesson'}".
- Answer only that question directly in at most two short sentences.
- Do not continue or resume the previous lesson unless the student asks you to.
- End by asking "${responseLanguage === 'en' ? 'Shall we continue from where we left off?' : responseLanguage === 'hi' ? 'क्या हम वहीं से जारी रखें?' : 'Kya hum wahin se continue karein?'}"
- Do not add a greeting or any other follow-up question.`;
          }

          let currentTurnPrompt = '';

          if (mode === 'lesson_start') {
            currentTurnPrompt = `CLASSROOM INSTRUCTION:
- You are beginning a new lesson on "${session.concept_id}".
- DO NOT wait for a question from the student.
- Do not greet the student; start teaching immediately.
- Begin naturally, for example: "Let's start with ${session.concept_id}..." or "Chalo, aaj ${session.concept_id} ke baare mein dekhte hain..."
- Explain the core idea simply in 2-3 sentences.
- End by asking a quick check-in question or inviting the student to ask a doubt.

Course Context:
${contextText}

${langInstruction}`;
          } else if (resume_lesson) {
            currentTurnPrompt = `The student agreed to continue the lesson.
- Briefly acknowledge their confirmation, then continue the lesson from immediately after this point: "${interrupted_at || 'the last lesson point'}".
- Do not repeat the explanation they interrupted.
- Keep this continuation to at most two short sentences.

Course Context:
${contextText}

${langInstruction}`;
          } else if (resume_decision === 'decline') {
            currentTurnPrompt = `The student declined to continue the paused lesson.
- Acknowledge briefly in ${responseLanguage === 'hi' ? 'Hindi' : responseLanguage === 'hinglish' ? 'Hinglish' : 'English'}.
- Do not resume or explain more unless they ask a new question.
- Keep the response to one short sentence.`;
          } else {
            currentTurnPrompt = `Student message: "${message}"

Course Context:
${contextText}

Pedagogy Directive: ${action.move}.
${action.specialInstruction || ''}
${langInstruction}
${greetingGuidance}
${interruptionGuidance}
${isInterruption
  ? 'Answer only the interruption question in at most two short sentences. Do not resume the lesson; ask whether to continue from where the lesson stopped.'
  : resume_lesson
    ? 'Continue the paused lesson from its stopping point. Keep the response to two short sentences.'
    : resume_decision === 'decline'
      ? 'Acknowledge the decision briefly and do not continue the lesson.'
  : 'Keep the answer friendly and concise (up to three sentences). Use markdown for math/code and end explanations with a brief check-in question.'}`;
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

4. COURSE SCOPE:
   - This tutor teaches the course topics: Arrays, Linked Lists, Stacks, Queues, their operations, implementations, and basic time/space complexity.
   - If asked about a topic outside this course, do not guess or provide an unrelated answer. Briefly say it is outside this tutor's current course and offer to help with one of the listed topics.
   - Do not treat a loosely related word in the course context as evidence that an unrelated question is in scope.

5. LANGUAGE & VOCABULARY:
   - Natural Indian teacher style: warm, concise, clear, and direct.
   - If Hinglish is requested or spoken: reply in natural, authentic Hinglish (Hindi grammar in Latin script).
   - Technical terms (Array, Queue, Stack, Linked List, FIFO, LIFO, index, pointer, node, enqueue, dequeue, push, pop, time complexity, etc.) MUST ALWAYS be kept in English.

6.
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
   - Do not use fenced code blocks for board content; use only the XML tags above.`
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
                systemInstruction: systemInstruction.parts[0].text,
                maxOutputTokens: isInterruption || resume_lesson ? 160 : 256,
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
                  systemInstruction: systemInstruction.parts[0].text,
                  maxOutputTokens: isInterruption || resume_lesson ? 160 : 256,
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

              const hasSentenceBoundary = /[.!?\u0964\u3002]\s/.test(sentenceBuffer);
              const hasClauseBoundary = /[,;:]\s/.test(sentenceBuffer)
                && sentenceBuffer.trim().split(/\s+/).length >= 12;
              if (hasSentenceBoundary || hasClauseBoundary) {
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

          // Persist mastery updates after generating the response.
          if (isAnswerTurn) {
            const newM = updateMastery(mastery, verdict === 'correct')
            const newStreak = verdict === 'correct'
              ?
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
