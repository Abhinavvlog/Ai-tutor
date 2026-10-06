-- Enable pgvector
create extension if not exists vector;

-- Profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  language text check (language in ('en','hi','hinglish')) not null,
  pace text check (pace in ('slow','normal','fast')) not null,
  created_at timestamp with time zone default now()
);

-- Concepts
create table concepts (
  id text primary key,
  title text not null,
  unit text not null,
  order_index int not null,
  description text not null
);

-- Concept Prerequisites
create table concept_prereqs (
  concept_id text references concepts(id) on delete cascade,
  prereq_id text references concepts(id) on delete cascade,
  primary key (concept_id, prereq_id)
);

-- Content Chunks
create table content_chunks (
  id uuid primary key default gen_random_uuid(),
  concept_id text references concepts(id) on delete cascade,
  source_title text not null,
  page int not null,
  text text not null,
  embedding vector(768) not null,
  approval_status text default 'approved'
);
create index on content_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Question Bank
create table question_bank (
  id uuid primary key default gen_random_uuid(),
  concept_id text references concepts(id) on delete cascade,
  type text check (type in ('mcq','numeric','short')) not null,
  stem text not null,
  options jsonb,
  answer text not null,
  rubric text,
  hint1 text,
  hint2 text,
  hint3 text,
  difficulty text check (difficulty in ('easy','medium','hard')) not null
);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade not null,
  concept_id text references concepts(id) on delete cascade not null,
  started_at timestamp with time zone default now(),
  ended_at timestamp with time zone,
  interruptions int default 0,
  current_question_id uuid references question_bank(id),
  hints_used int default 0
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  role text check (role in ('student','tutor')) not null,
  content text not null,
  move text,
  citations jsonb,
  created_at timestamp with time zone default now()
);

-- Attempts
create table attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references sessions(id) on delete cascade not null,
  concept_id text references concepts(id) on delete cascade not null,
  question_id uuid references question_bank(id) on delete cascade not null,
  verdict text check (verdict in ('correct','partial','wrong')) not null,
  hints_used int not null,
  response_ms int,
  created_at timestamp with time zone default now()
);

-- Mastery
create table mastery (
  student_id uuid references auth.users(id) on delete cascade not null,
  concept_id text references concepts(id) on delete cascade not null,
  p_mastery float default 0.30,
  correct_streak int default 0,
  difficulty text default 'easy',
  updated_at timestamp with time zone default now(),
  primary key (student_id, concept_id)
);

-- Misconceptions
create table misconceptions (
  student_id uuid references auth.users(id) on delete cascade not null,
  concept_id text references concepts(id) on delete cascade not null,
  tag text not null,
  count int not null default 1,
  last_seen timestamp with time zone default now(),
  primary key (student_id, concept_id, tag)
);

-- Row Level Security on every table
alter table profiles enable row level security;
alter table concepts enable row level security;
alter table concept_prereqs enable row level security;
alter table content_chunks enable row level security;
alter table question_bank enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;
alter table attempts enable row level security;
alter table mastery enable row level security;
alter table misconceptions enable row level security;

-- Authenticated users can read content tables (concepts, concept_prereqs, content_chunks, question_bank)
create policy "Authenticated users can read concepts" on concepts for select to authenticated using (true);
create policy "Authenticated users can read concept_prereqs" on concept_prereqs for select to authenticated using (true);
create policy "Authenticated users can read content_chunks" on content_chunks for select to authenticated using (true);
create policy "Authenticated users can read question_bank" on question_bank for select to authenticated using (true);

-- Students read only their own rows in others
create policy "Students can read their own profile" on profiles for select to authenticated using (auth.uid() = id);
-- allow profile creation during anonymous auth setup:
create policy "Students can insert their own profile" on profiles for insert to authenticated with check (auth.uid() = id);

create policy "Students can read their own sessions" on sessions for select to authenticated using (auth.uid() = student_id);
-- Allow students to create sessions
create policy "Students can insert their own sessions" on sessions for insert to authenticated with check (auth.uid() = student_id);

create policy "Students can read messages of their sessions" on messages for select to authenticated using (
  session_id in (select id from sessions where student_id = auth.uid())
);
-- Allow students to insert messages
create policy "Students can insert messages to their sessions" on messages for insert to authenticated with check (
  session_id in (select id from sessions where student_id = auth.uid())
);

create policy "Students can read their own attempts" on attempts for select to authenticated using (auth.uid() = student_id);
create policy "Students can read their own mastery" on mastery for select to authenticated using (auth.uid() = student_id);
create policy "Students can read their own misconceptions" on misconceptions for select to authenticated using (auth.uid() = student_id);

-- Only the service role writes to messages, attempts, mastery, misconceptions and sessions
-- Wait, the prompt says: "Only the service role (Edge Functions) writes to messages, attempts, mastery, misconceptions and sessions."
-- But students need to insert messages when they speak, or they call an Edge Function which inserts it?
-- The spec says: "TUTOR TURN (Edge Function: tutor-turn) Request (POST): {session_id, message, input_mode: "text"|"voice", interrupted: boolean}"
-- So the student's message is passed as a payload to the edge function, and the edge function writes it using service role key!
-- Okay, so NO insert policies for students on messages, attempts, mastery, misconceptions. 
-- What about sessions? "Only the service role ... writes to ... sessions."
-- Actually, the spec literally says: "Only the service role (Edge Functions) writes to messages, attempts, mastery, misconceptions and sessions."
-- So I will remove the insert policies for students on those tables.

drop policy if exists "Students can insert their own sessions" on sessions;
drop policy if exists "Students can insert messages to their sessions" on messages;
