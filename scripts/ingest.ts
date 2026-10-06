import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// The spec says use gemini-embedding-001, but the API expects specific formats for the SDK.
// We'll use the raw REST API for simplicity to avoid SDK dependencies just for this script, 
// or use @google/genai if available. 
// Since it's a simple script, we'll use fetch.

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.MYGURU_SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;
const embedModel = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';

const supabase = createClient(supabaseUrl, supabaseKey);

async function getEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${geminiApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${embedModel}`,
      content: { parts: [{ text }] },
      outputDimensionality: 768
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to get embedding: ${await response.text()}`);
  }
  const data = await response.json();
  return data.embedding.values;
}

// Simple chunker by words instead of strict tokens to avoid complex tokenizers,
// assuming ~1.3 tokens per word, 200 tokens is ~150 words.
function chunkText(text: string, maxWords = 250, overlapWords = 35) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords - overlapWords) {
    const chunk = words.slice(i, i + maxWords).join(' ');
    chunks.push(chunk);
    if (i + maxWords >= words.length) {
      break;
    }
  }
  return chunks;
}

async function run() {
  const contentDir = path.join(process.cwd(), 'content');
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(contentDir, file), 'utf8');
    
    // Parse frontmatter
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      console.log(`Skipping ${file} - no frontmatter`);
      continue;
    }

    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    const metadata: Record<string, any> = {};
    frontmatter.split('\n').forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        metadata[key.trim()] = rest.join(':').trim();
      }
    });

    const chunks = chunkText(body);
    console.log(`Processing ${file}: ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk);
      const { error } = await supabase.from('content_chunks').insert({
        concept_id: metadata.concept_id,
        source_title: metadata.source_title,
        page: parseInt(metadata.page || '1'),
        text: chunk,
        embedding: embedding
      });

      if (error) {
        console.error('Error inserting chunk:', error);
      }
    }
  }
  console.log('Ingestion complete!');
}

run().catch(console.error);
