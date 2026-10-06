import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.39.3'
import { z } from 'npm:zod@3.22.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ttsSchema = z.object({
  text: z.string().min(1),
  language: z.enum(['en', 'hi', 'hinglish']).optional().default('en'),
});

// In-memory audio response cache (up to 300 entries to prevent re-fetching and save rate limits)
const audioCache = new Map<string, { audio_base64: string; mime_type: string; sample_rate: number }>();

// In-memory sliding window rate limiter: 60 requests per minute per user
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 60000;
  const timestamps = rateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter(t => t > windowStart);
  
  if (validTimestamps.length >= 60) {
    rateLimitMap.set(userId, validTimestamps);
    return false;
  }
  
  validTimestamps.push(now);
  rateLimitMap.set(userId, validTimestamps);
  return true;
}

const HINGLISH_MARKERS = new Set([
  'hai', 'hain', 'mein', 'kya', 'kyun', 'kyu', 'kaise', 'hota', 'hoti', 'hote',
  'karte', 'karta', 'karti', 'karein', 'samjho', 'samjhao', 'dekhte', 'dekho',
  'chalo', 'aaj', 'ek', 'aur', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'bhi', 'toh',
  'agar', 'wala', 'wali', 'wale', 'raha', 'rahi', 'rahe', 'tha', 'thi', 'the',
  'baare', 'bilkul', 'pehle', 'aakhri', 'karo', 'lekin', 'kyunki', 'iska', 'iski',
  'iske', 'uske', 'inka', 'unka', 'hum', 'aap', 'tum', 'yeh', 'woh', 'yahan',
  'wahan', 'kahan', 'sirf', 'saath', 'andar', 'baahar', 'madad', 'batao', 'samajh',
  'ruko', 'suno', 'padhenge', 'seekhenge', 'tarah', 'karke'
]);

function detectContentLanguage(text: string, requestedLang?: string): 'en' | 'hi' | 'hinglish' {
  if (!text || !text.trim()) return (requestedLang as any) || 'en';

  const trimmed = text.trim();

  // 1. Check for Devanagari script characters
  const hasDevanagari = /[\u0900-\u097F]/.test(trimmed);
  if (hasDevanagari) {
    const hasLatinWords = /[a-zA-Z]{2,}/.test(trimmed);
    return hasLatinWords ? 'hinglish' : 'hi';
  }

  // 2. Tokenize Latin words
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) return (requestedLang as any) || 'en';

  let markerCount = 0;
  for (const word of words) {
    if (HINGLISH_MARKERS.has(word)) {
      markerCount++;
    }
  }

  const markerRatio = markerCount / words.length;

  if (markerCount >= 2 || (words.length >= 3 && markerRatio >= 0.12)) {
    return 'hinglish';
  }

  if (requestedLang === 'hi' || requestedLang === 'hinglish') {
    return markerCount >= 1 ? 'hinglish' : 'en';
  }

  return 'en';
}

function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';

  return raw
    // Remove markdown code blocks and backticks
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove LaTeX math formatting
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$]+)\$/g, '$1')
    // Convert array indices like [0], [1] to "index 0", "index 1" for spoken clarity
    .replace(/\[(\d+)\]/g, ' index $1 ')
    // Clean markdown headings, bullets, quotes, bold, italics
    .replace(/[#*~>]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Replace technical course IDs (e.g. arrays_1 -> arrays)
    .replace(/_1\b/g, '')
    .replace(/_2\b/g, ' part 2')
    .replace(/_/g, ' ')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  const words = text.split(/\s+/);
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + word;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
      
      // If a single word is longer than maxLength, force split it
      while (currentChunk.length > maxLength) {
        chunks.push(currentChunk.substring(0, maxLength));
        currentChunk = currentChunk.substring(maxLength);
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  return chunks;
}

async function fetchGoogleNativeTTS(text: string, lang: string): Promise<{ audio_base64: string; mime_type: string; sample_rate: number } | null> {
  try {
    const chunks = chunkText(text, 150);
    const buffers: Uint8Array[] = [];
    
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      
      const encoded = encodeURIComponent(chunk);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
      
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        buffers.push(new Uint8Array(arrayBuf));
      } else {
        console.warn(`[Google Native TTS warning]: Failed for chunk "${chunk}". Status: ${res.status}`);
        return null;
      }
    }
    
    if (buffers.length === 0) return null;
    
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      combined.set(buf, offset);
      offset += buf.byteLength;
    }
    
    let binary = '';
    const len = combined.byteLength;
    // Chunk the binary string conversion to avoid call stack limits
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(combined.subarray(i, Math.min(i + chunkSize, len))));
    }
    
    const b64 = btoa(binary);
    return {
      audio_base64: b64,
      mime_type: 'audio/mpeg',
      sample_rate: 24000
    };
  } catch (e) {
    console.warn('[Google Native TTS warning]:', e);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('MYGURU_SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    let userId = 'anon_user';
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabaseClient.auth.getUser(token)
      if (user) userId = user.id;
    }

    // Rate limiting: 60 requests per minute per user
    if (!checkRateLimit(userId)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded: max 60 requests per minute' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { text, language } = ttsSchema.parse(body)

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) {
      return new Response(JSON.stringify({ error: 'Text is empty after cleaning' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deterministically classify the actual generated sentence language
    const detectedLang = detectContentLanguage(cleanedText, language);

    // Check in-memory cache first
    const cacheKey = `${detectedLang}:${cleanedText.toLowerCase()}`;
    const cached = audioCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let finalResult: { audio_base64: string; mime_type: string; sample_rate: number } | null = null;

    // For Hindi, use native Hindi voice. For Hinglish (Latin script), use Indian English voice for better flow.
    if (detectedLang === 'hi' || detectedLang === 'hinglish') {
      const targetLang = detectedLang === 'hi' ? 'hi' : 'en-IN';
      finalResult = await fetchGoogleNativeTTS(cleanedText, targetLang);
    }

    // For English (or if Google Native TTS returned null), try Gemini TTS / Google English
    if (!finalResult) {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      const voiceName = detectedLang === 'hi' ? 'Aoede' : 'Kore';

      if (apiKey) {
        const candidateModels = [
          'gemini-3.8-flash-lite-tts',
          'gemini-3.8-flash-tts',
          'gemini-2.5-flash-preview-tts'
        ];

        for (const model of candidateModels) {
          try {
            const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(ttsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: cleanedText }] }],
                generationConfig: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName }
                    }
                  }
                }
              })
            });

            if (response.ok) {
              const data = await response.json();
              const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
              if (inlineData?.data) {
                const mimeType = inlineData.mimeType || 'audio/l16; rate=24000; channels=1';
                let sampleRate = 24000;
                const rateMatch = mimeType.match(/rate=(\d+)/);
                if (rateMatch) sampleRate = parseInt(rateMatch[1], 10);
                finalResult = {
                  audio_base64: inlineData.data,
                  mime_type: mimeType,
                  sample_rate: sampleRate
                };
                break;
              }
            }
          } catch (_) {}
        }
      }

      // If Gemini TTS failed or was rate limited, fallback to Google Native English/Indian voice
      if (!finalResult) {
        const fallbackLang = detectedLang === 'hi' ? 'hi' : (detectedLang === 'hinglish' ? 'en-IN' : 'en');
        finalResult = await fetchGoogleNativeTTS(cleanedText, fallbackLang);
      }
    }

    if (!finalResult) {
      return new Response(JSON.stringify({ error: 'All TTS engines failed to produce audio' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Store in cache
    if (audioCache.size >= 300) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, finalResult);

    return new Response(JSON.stringify(finalResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
