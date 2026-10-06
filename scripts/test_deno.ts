import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

async function test() {
  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL');
  const supabaseKey = Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const query_embedding = Array(768).fill(0.1);
  const { data, error } = await supabase.rpc('match_content_chunks', {
    query_embedding,
    match_threshold: 0,
    match_count: 4,
    filter_concept_ids: ['arrays_1']
  });

  console.log('Array passing:', { data, error });

  const query_embedding_str = JSON.stringify(query_embedding);
  const { data: data2, error: error2 } = await supabase.rpc('match_content_chunks', {
    query_embedding: query_embedding_str,
    match_threshold: 0,
    match_count: 4,
    filter_concept_ids: ['arrays_1']
  });

  console.log('String passing:', { data2, error2 });
}

test();
