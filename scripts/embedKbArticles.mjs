import { createClient } from '@supabase/supabase-js';
import { google } from '@ai-sdk/google';
import { embed } from 'ai';
import 'dotenv/config'; // To load .env variables

// --- Configuration ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service_role key for admin operations
const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_API_KEY) {
  throw new Error(
    'Missing Supabase URL, Supabase Service Key, or Google API Key in environment variables.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const embeddingModel = google.textEmbedding('embedding-001'); // Correct model name without 'models/' prefix

const MAX_CHUNK_LENGTH_CHARS = 1500; // Max characters per chunk
const MIN_CHUNK_LENGTH_CHARS = 50;   // Min characters to consider a chunk valid

// --- Chunking Function ---
function chunkArticleContent(articleId, title, content) {
  const chunks = [];
  // Split by H2 headings (##), then by paragraphs
  // Prepend H2 heading to each subsequent paragraph chunk for context

  const sections = content.split(/\n##\s+/); // Split by "## "
  let isFirstSection = true;

  for (let section of sections) {
    let currentH2Heading = '';
    if (!isFirstSection) {
      const lines = section.split('\n');
      currentH2Heading = `## ${lines[0]}`.trim(); // Assumes heading is the first line after split
      section = lines.slice(1).join('\n');
    } else {
      // For the first section (before any ## heading)
      if (content.startsWith('## ')) {
        const lines = section.split('\n');
        if (lines[0].trim() !== "") {
          // Content before first H2
          currentH2Heading = title || '';
        }
      } else {
        currentH2Heading = title || '';
      }
    }
    isFirstSection = false;

    const paragraphs = section.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > MIN_CHUNK_LENGTH_CHARS);

    for (const paragraph of paragraphs) {
      let chunkText = paragraph;
      if (currentH2Heading) {
        chunkText = `${currentH2Heading}\n${paragraph}`;
      }
      
      // Split if paragraph is too long
      if (chunkText.length > MAX_CHUNK_LENGTH_CHARS) {
        // Split by sentences to maintain context better
        const sentences = chunkText.match(/[^.!?]+[.!?]+/g) || [chunkText];
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH_CHARS) {
            if (currentChunk.length > MIN_CHUNK_LENGTH_CHARS) {
              chunks.push({
                kb_article_id: articleId,
                content_chunk: currentChunk.trim(),
              });
            }
            currentChunk = sentence;
          } else {
            currentChunk += sentence;
          }
        }
        
        if (currentChunk.length > MIN_CHUNK_LENGTH_CHARS) {
          chunks.push({
            kb_article_id: articleId,
            content_chunk: currentChunk.trim(),
          });
        }
      } else if (chunkText.length > MIN_CHUNK_LENGTH_CHARS) {
        chunks.push({
          kb_article_id: articleId,
          content_chunk: chunkText,
        });
      }
    }
  }
  
  // Handle case where no chunks were created
  if (chunks.length === 0 && content.trim().length > MIN_CHUNK_LENGTH_CHARS) {
    let chunkText = content.trim();
    if (title) {
      chunkText = `${title}\n${chunkText}`;
    }
    
    if (chunkText.length > MAX_CHUNK_LENGTH_CHARS) {
      const sentences = chunkText.match(/[^.!?]+[.!?]+/g) || [chunkText];
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > MAX_CHUNK_LENGTH_CHARS) {
          if (currentChunk.length > MIN_CHUNK_LENGTH_CHARS) {
            chunks.push({
              kb_article_id: articleId,
              content_chunk: currentChunk.trim(),
            });
          }
          currentChunk = sentence;
        } else {
          currentChunk += sentence;
        }
      }
      
      if (currentChunk.length > MIN_CHUNK_LENGTH_CHARS) {
        chunks.push({
          kb_article_id: articleId,
          content_chunk: currentChunk.trim(),
        });
      }
    } else {
      chunks.push({
        kb_article_id: articleId,
        content_chunk: chunkText,
      });
    }
  }

  console.log(`Article ID ${articleId}: Generated ${chunks.length} chunks.`);
  return chunks;
}

// --- Main Processing Function ---
async function processAndEmbedArticles() {
  console.log('Fetching articles from Supabase...');
  const { data: articles, error: fetchError } = await supabase
    .from('kb_articles')
    .select('id, title, content');

  if (fetchError) {
    console.error('Error fetching articles:', fetchError);
    return;
  }

  if (!articles || articles.length === 0) {
    console.log('No articles found to process.');
    return;
  }

  console.log(`Found ${articles.length} articles to process.`);

  for (const article of articles) {
    console.log(`\nProcessing article ID: ${article.id}, Title: ${article.title}`);
    if (!article.content || article.content.trim() === "") {
      console.log(`Skipping article ID: ${article.id} due to empty content.`);
      continue;
    }

    const chunksToEmbed = chunkArticleContent(article.id, article.title, article.content);

    if (chunksToEmbed.length === 0) {
      console.log(`No valid chunks generated for article ID: ${article.id}.`);
      continue;
    }

    for (const chunk of chunksToEmbed) {
      try {
        console.log(`  Embedding chunk: "${chunk.content_chunk.substring(0, 50)}..."`);
        
        // Get embedding from Google's model
        const { embedding } = await embed({
          model: embeddingModel,
          value: chunk.content_chunk,
        });

        // Store in Supabase
        const { error: insertError } = await supabase
          .from('kb_article_chunks')
          .insert({
            kb_article_id: chunk.kb_article_id,
            content_chunk: chunk.content_chunk,
            embedding: embedding,
          });

        if (insertError) {
          console.error(`  Error inserting chunk for article ID ${chunk.kb_article_id}:`, insertError.message);
        } else {
          console.log(`  Successfully embedded and stored chunk for article ID ${chunk.kb_article_id}.`);
        }

        // Add a small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (embedError) {
        console.error(`  Error embedding chunk for article ID ${chunk.kb_article_id}:`, embedError);
      }
    }
  }

  console.log('\nEmbedding process finished.');
}

// --- Run the script ---
processAndEmbedArticles().catch(console.error); 