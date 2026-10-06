import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = process.env.MYGURU_SUPABASE_SERVICE_ROLE_KEY || env.MYGURU_SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = env.GEMINI_API_KEY;

if (!supabaseKey) {
  console.error('No service role key found!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('1. Checking content_chunks count');
  const { count, error: countErr } = await supabase.from('content_chunks').select('*', { count: 'exact', head: true });
  console.log('Total chunks:', count, countErr);

  console.log('2. Checking arrays_1 chunks');
  const { data: arrayChunks, error: arrayErr } = await supabase.from('content_chunks').select('id, text, concept_id').eq('concept_id', 'arrays_1');
  console.log('arrays_1 count:', arrayChunks?.length, arrayErr);
  
  if (arrayChunks && arrayChunks.length > 0) {
    console.log('Sample text length:', arrayChunks[0].text.length);
  }

  console.log('3. Fetching arrays_1 embeddings to check dimensions');
  const { data: embData } = await supabase.from('content_chunks').select('embedding').eq('concept_id', 'arrays_1').limit(1);
  if (embData && embData.length > 0) {
    let embStr = embData[0].embedding;
    // Embedding comes back as a string from pgvector in some JS clients, or array.
    if (typeof embStr === 'string') {
      const arr = JSON.parse(embStr);
      console.log('Embedding dimensions:', arr.length);
    } else if (Array.isArray(embStr)) {
      console.log('Embedding dimensions:', embStr.length);
    }
  }

  console.log('4. Generating embedding for "what is array"');
  const embedRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/gemini-embedding-001`,
      content: { parts: [{ text: "what is array" }] },
      outputDimensionality: 768
    })
  });
  const embedData = await embedRes.json();
  const query_embedding = embedData.embedding.values;
  console.log('Query embedding dims:', query_embedding?.length);

  console.log('5. Testing match_content_chunks RPC');
  const { data: matches, error: matchErr } = await supabase.rpc('match_content_chunks', {
    query_embedding,
    match_threshold: 0.55,
    match_count: 4,
    filter_concept_ids: ['arrays_1']
  });
  
  console.log('Matches:', matches?.length, matchErr);
  if (matches && matches.length > 0) {
    console.log('Top match similarity:', matches[0].similarity);
  }

  // Also test with threshold 0 to see what the highest score actually is
  console.log('6. Testing match_content_chunks RPC with threshold 0');
  const { data: matches0, error: matchErr0 } = await supabase.rpc('match_content_chunks', {
    query_embedding,
    match_threshold: 0,
    match_count: 4,
    filter_concept_ids: ['arrays_1']
  });
  
  console.log('Matches (threshold 0):', matches0?.length);
  if (matches0 && matches0.length > 0) {
    console.log('Top match similarity:', matches0[0].similarity);
  }
}

run();
