-- Create a function to match content chunks based on cosine similarity
create or replace function match_content_chunks(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_concept_ids text[]
)
returns table (
  id uuid,
  concept_id text,
  source_title text,
  page int,
  text text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    content_chunks.id,
    content_chunks.concept_id,
    content_chunks.source_title,
    content_chunks.page,
    content_chunks.text,
    1 - (content_chunks.embedding <=> query_embedding) as similarity
  from content_chunks
  where 1 - (content_chunks.embedding <=> query_embedding) > match_threshold
    and content_chunks.concept_id = any(filter_concept_ids)
  order by content_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;
