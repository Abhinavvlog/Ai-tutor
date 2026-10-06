ROLE

You are a senior full-stack engineer and UI/UX designer. Build a working prototype of MyGuru AI Teacher: a 3D AI teacher that teaches a college course in real time and adapts the lesson to the student. Write strict TypeScript. No TODOs, no lorem ipsum, no placeholder text. Build the steps in the order given under BUILD ORDER and finish each step completely before starting the next.

PROTOTYPE GOAL

Prove two things in one live demo: (1) real-time interaction: the student speaks or types, the 3D teacher answers aloud within about 2.5 seconds, and the student can interrupt at any moment; (2) adaptive learning: the teaching move, difficulty and hints change based on the student's answers and tracked mastery.

SCOPE

One course only: Data Structures, with two units: Arrays and Linked Lists; Stacks and Queues (6 concepts total). One demo student at a time. No parent features, admin UI, payments or pricing.

TECH STACK
Frontend: React 18 + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Router, Zustand, KaTeX, react-markdown.
3D: three, @react-three/fiber, @react-three/drei, @pixiv/three-vrm.
Backend: Supabase (Postgres, anonymous Auth, Row Level Security, Edge Functions in Deno/TypeScript, pgvector with 768 dimensions).
AI: Google Gemini API, called ONLY from Edge Functions. Secrets: GEMINI_API_KEY, GEMINI_MODEL (default gemini-2.5-flash), GEMINI_EMBED_MODEL (default gemini-embedding-001, requested with 768 output dimensions), GEMINI_TTS_MODEL. Never expose keys to the browser or logs.
Math checking: mathjs in the Edge Function.
Voice input: browser SpeechRecognition (en-IN or hi-IN). Voice output: audio from the tts Edge Function only. Never use browser speechSynthesis.
Streaming: Server-Sent Events.
Env: .env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
DATABASE (one SQL migration)
profiles(id uuid pk = auth.uid(), display_name text, language text in ('en','hi','hinglish'), pace text in ('slow','normal','fast'), created_at)
concepts(id text pk, title text, unit text, order_index int, description text)
concept_prereqs(concept_id text, prereq_id text)
content_chunks(id uuid pk, concept_id text, source_title text, page int, text text, embedding vector(768), approval_status text default 'approved'), with an ivfflat cosine index
question_bank(id uuid pk, concept_id text, type text in ('mcq','numeric','short'), stem text, options jsonb, answer text, rubric text, hint1 text, hint2 text, hint3 text, difficulty text in ('easy','medium','hard'))
sessions(id uuid pk, student_id uuid, concept_id text, started_at, ended_at, interruptions int default 0, current_question_id uuid null, hints_used int default 0)
messages(id uuid pk, session_id uuid, role text in ('student','tutor'), content text, move text null, citations jsonb null, created_at)
attempts(id uuid pk, student_id uuid, session_id uuid, concept_id text, question_id uuid, verdict text in ('correct','partial','wrong'), hints_used int, response_ms int, created_at)
mastery(student_id uuid, concept_id text, p_mastery float default 0.30, correct_streak int default 0, difficulty text default 'easy', updated_at; pk(student_id, concept_id))
misconceptions(student_id uuid, concept_id text, tag text, count int, last_seen; pk(student_id, concept_id, tag))

Row Level Security on every table. Authenticated users can read content tables. Students read only their own rows in the others. Only the service role (Edge Functions) writes to messages, attempts, mastery, misconceptions and sessions.

CONTENT AND SEED
Folder /content with 6 markdown files (one per concept), each with front matter (concept_id, source_title, page) and 3 to 5 short sections of original educational text (no copied textbook text). Prerequisite links: arrays before linked lists; linked lists before stacks; stacks before queues.
Seed 5 questions per concept (mix of mcq, numeric and short, each with three hint levels and a difficulty), written in a seed SQL file.
Script scripts/ingest.ts (run locally with the service role key): reads /content, chunks into 200 to 500 token pieces with 50 token overlap, generates embeddings with GEMINI_EMBED_MODEL, and inserts into content_chunks.
TUTOR TURN (Edge Function: tutor-turn)

Request (POST): {session_id, message, input_mode: "text"|"voice", interrupted: boolean}
SSE events:

token {text}
sentence {index, text}: a completed sentence ready for speech
board {markdown}: content for the digital board (markdown with LaTeX)
meta {move, concept_id, expression, citations: [{source_title, page, chunk_id}], p_mastery}
done {}
error {message}

Pipeline:

Validate the input with Zod. Rate limit 30 requests per minute per user.
Basic moderation: block self-harm, sexual and violent content and prompt-injection patterns ("ignore previous instructions", "reveal your prompt") with a friendly scripted redirect and no LLM call.
Classify the turn with a short Gemini call returning JSON: question, answer_to_tutor, confusion, off_topic, emotion or smalltalk. Skip retrieval for smalltalk and emotion.
In parallel: load mastery, misconceptions and session state; rewrite the query and retrieve the top 4 chunks by cosine similarity filtered by concept and its prerequisites; check the answer if the turn is answer_to_tutor.
Answer checking: numeric with mathjs (tolerance 1e-6); mcq by exact match; short text graded by Gemini against the rubric and retrieved chunk, returning {verdict, misconception_tag|null}.
Pedagogy policy in a deterministic, unit-tested module pedagogy.ts:
mastery below 0.60 and 2 hints used leads to worked_example
3 correct answers in a row raises difficulty one level
2 interruptions in one explanation leads to asking "Would you like me to explain this differently?"
more than 10 minutes on one concept leads to suggesting a break
never reveal the final answer before hint_2
a known misconception on the concept adds a contrast question
mastery of 0.80 or above leads to advance to the next concept (check prerequisites first)
Allowed moves: explain, example, socratic_question, hint_1, hint_2, hint_3, worked_example, practice_problem, revisit_prerequisite, retrieve_fact, encourage, advance.
Generate with Gemini in streaming mode. Use only retrieved chunks, at most 5 sentences, cite as [Source title, p.N], end with one guiding question for explain and socratic_question, and match the student's language setting.
Grounding fallback: if best chunk similarity is below 0.55, reply "I'm not fully sure about this from your course material. Please check your textbook or ask your teacher." Do not answer from model knowledge.
After streaming (do not block it): update mastery with Bayesian Knowledge Tracing (p_init 0.30, p_learn 0.15, p_guess 0.20, p_slip 0.10); update misconceptions; save the message and attempt rows.
Timeout of 20 seconds per Gemini call, one retry with backoff, friendly error event on failure.
TTS (Edge Function: tts)

Request: {text, language}. Response: {audio_base64, mime_type, sample_rate}. Convert one sentence to speech using GEMINI_TTS_MODEL with an English or Hindi voice according to the language. Read the sample rate and format from the API response and pass them through. The client converts the audio into a Web Audio AudioBuffer. Do not store audio. Rate limit 60 requests per minute per user.

FRONTEND

Pages: / (start screen: name, language, pace, "Start learning", then anonymous sign-in), /learn/:conceptId (the tutor), /progress (mastery per concept, simple list with bars and a concept order view).

Tutor page layout

Desktop (1024px and up): header with concept name and mastery ring; 3D teacher stage on the left (45%); digital board in the middle (35%); transcript panel on the right (20%, expandable); bottom bar with text field, microphone, send and Stop.
Mobile (below 768px): teacher in the top third; Board and Transcript tabs below; input bar fixed at the bottom with safe-area padding.
Captions of the sentence being spoken are always shown under the teacher. Citation chips open a drawer with the source text and page.

Digital board: renders board events (headings, bullet steps, KaTeX equations, tables). Keeps the last 10 entries; the student can clear it.

Real-time behaviour

The microphone shows interim transcripts live and sends after 1.2 seconds of silence.
Each sentence event goes straight to tts. The client keeps an ordered audio queue and starts playing the first sentence as soon as its audio is ready.
Interruption: new speech, a keystroke in the input, or the Stop button must within 100 ms abort the SSE stream (AbortController), stop the audio, clear the queue and send the new turn with interrupted=true.
A dev-only footer shows time to first token and time to first audio. Targets: first token under 1.5 s and first audio under 2.5 s on 4G.
3D TEACHER
Load /public/avatars/teacher.vrm with @pixiv/three-vrm in a React Three Fiber canvas. If the file is missing, render a simple fallback character built from primitive shapes. Keep the model under 8 MB, cap pixel ratio at 2, lazy-load the scene.
Lip-sync: connect playing audio to a Web Audio AnalyserNode and map loudness each frame to the VRM mouth expressions (aa, ih, ou, ee, oh) with smoothing. It must work for English and Hindi; keep sync error under 100 ms.
State machine in avatarController.ts: idle (breathing, blinking every 3 to 6 s, small eye movement); listening (head tilt, occasional nod while the student speaks); thinking (looks slightly up and aside from sending a turn until first audio); speaking (head and hand gestures matched to speech rhythm); pointing_board (looks toward the board and points when a board event arrives).
Expressions from meta.expression: neutral, smile, concerned, focused, raised_brows, celebrate. Map moves to expressions: encourage to smile; hint_1 to hint_3 to raised_brows; worked_example to focused; wrong answer to concerned (warm, never negative); advance to celebrate.
On interruption, the teacher stops speaking and moves to listening within 100 ms.
Weak device or no WebGL: show a static 2D teacher image with a speaking indicator. Respect prefers-reduced-motion by reducing gestures.
UI RULES

Colors: navy 
#1F3A5F, teal 
#2A7F8E, highlight 
#F2A93B, background 
#F7F9FB, text 
#1A1A1A, success 
#2E9E6B, error 
#D64545. Fonts: Inter (body), Poppins (headings). Body 16px minimum. Touch targets 44px minimum. WCAG AA contrast, keyboard navigation, visible focus rings, aria-live polite on captions. Loading, empty and error states on every screen. Responsive from 360px to 1920px.

BUILD ORDER
Project setup, SQL migration, RLS, seed SQL, content files, ingest script, anonymous auth, start screen.
tutor-turn function and a text-only tutor page with streaming, citations, board, pedagogy, answer checking and mastery updates, plus the /progress page.
Voice input, tts function, audio queue, captions and interruption.
3D teacher with lip-sync, state machine, expressions and fallback.
Tests and README.
OUTPUT
Complete repository: /src, /supabase/migrations, /supabase/functions, /supabase/seed, /content, /scripts, README.md, .env.example.
README: Supabase setup, running the migration and seed, setting secrets, deploying functions, running ingest, adding teacher.vrm (with a note to check the model's licence), and local run steps.
Vitest tests, at least 5 cases each, for pedagogy.ts, the BKT update, the answer checker, the avatarController state machine and the audio queue (ordering and interruption).
The app must run end to end after the README steps and deliver a spoken lesson with the 3D teacher, interruption, and adaptive hints on the seeded course.
DO NOT BUILD

Parent dashboard, consent flow, admin UI, practice or revision pages, pricing or plans, payments, scheduled jobs, code execution sandbox, web scraping, audio storage, browser speechSynthesis, client-side LLM or TTS calls, exposed keys, fine-tuning, phoneme-level lip-sync, native apps, a second course, copyrighted text in the seed data, localStorage for auth tokens.

Before you run it, have these ready: a Supabase project, a Gemini API key from AI Studio with the model names confirmed (especially the TTS model), and a teacher.vrm file.