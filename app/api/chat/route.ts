// app/api/chat/route.ts

import { google } from '@ai-sdk/google';
import { CoreMessage, streamText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';

// Ensure environment variables are set
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase environment variables.');
}

// Function to get a new Supabase client with service role
function getSupabaseSrv() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        persistSession: false, // Ensure sessions aren't persisted
        autoRefreshToken: false // Disable auto token refresh
      }
    }
  );
}

export const runtime = 'edge';

// Initialize the embedding model
const embeddingModel = google.textEmbedding('embedding-001');

// Function to perform semantic search
async function performSemanticSearch(query: string, limit: number = 5): Promise<string> {
  try {
    console.log('Starting semantic search for query:', query);
    
    // Get a new Supabase client instance
    const supabase = getSupabaseSrv();
    
    // Generate embedding for the query
    console.log('Generating embedding for query using model:', embeddingModel);
    const { embedding } = await embed({
      model: embeddingModel,
      value: query,
    });
    console.log('Generated embedding length:', embedding.length);
    console.log('First few values of embedding:', embedding.slice(0, 5));

    // Perform vector similarity search in Supabase
    console.log('Calling match_kb_chunks with params:', {
      embedding_length: embedding.length,
      match_count: limit,
      match_threshold: 0.3
    });
    
    let { data: chunks, error } = await supabase.rpc('match_kb_chunks', {
      query_embedding: embedding,
      match_count: limit,
      match_threshold: 0.3
    });
    
    if (error) {
      console.error('Error performing semantic search:', error);
      if (typeof error === 'object' && error !== null) {
        console.error('Full error details:', JSON.stringify(error, null, 2));
      }
      return '';
    }
    
    console.log('Retrieved chunks from Supabase:', JSON.stringify(chunks, null, 2));
    
    if (!chunks || chunks.length === 0) {
      console.log('No matching chunks found above threshold 0.3');
      // Try with an even lower threshold as a fallback
      const { data: fallbackChunks, error: fallbackError } = await supabase.rpc('match_kb_chunks', {
        query_embedding: embedding,
        match_count: limit,
        match_threshold: 0.1  // Much lower threshold for fallback
      });
      
      if (fallbackError || !fallbackChunks || fallbackChunks.length === 0) {
        console.log('No matches found even with lower threshold');
        return '';
      }
      
      console.log('Found matches with lower threshold:', JSON.stringify(fallbackChunks, null, 2));
      chunks = fallbackChunks;
    }

    // Get the article details for each chunk
    const chunkIds = chunks.map((chunk: { kb_article_id: number }) => chunk.kb_article_id);
    console.log('Article IDs to fetch:', chunkIds);
    
    const { data: articles, error: articleError } = await supabase
      .from('kb_articles')
      .select('id, title')
      .in('id', chunkIds);

    if (articleError) {
      console.error('Error fetching article details:', articleError);
      return '';
    }
    
    console.log('Retrieved articles:', JSON.stringify(articles, null, 2));

    if (!articles || articles.length === 0) {
      console.log('No articles found for the chunk IDs');
      return '';
    }

    // Create a map of article IDs to titles
    const articleTitles = new Map(articles.map((article: { id: number, title: string }) => [article.id, article.title]));
    console.log('Article titles map:', Object.fromEntries(articleTitles));

    // Combine the chunks into context with source information
    const context = chunks
      .map((chunk: { content_chunk: string, kb_article_id: number }) => {
        const articleTitle = articleTitles.get(chunk.kb_article_id) || 'Unknown Article';
        return `[Source: "${articleTitle}"]\n${chunk.content_chunk}`;
      })
      .join('\n\n');
    
    console.log('Final context generated:', context);
    return context;
  } catch (error: unknown) {
    console.error('Error in semantic search:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    return '';
  }
}

// Helper function to prepare messages for the LLM.
const prepareMessagesForLLM = (messages: CoreMessage[]): { chatMessages: CoreMessage[], systemMessage?: string } => {
  let systemMessage: string | undefined = undefined;
  const chatMessages: CoreMessage[] = [];
  
  messages.forEach(msg => {
    if (msg.role === 'system') {
      systemMessage = (systemMessage ? `${systemMessage}\n` : '') + msg.content;
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      chatMessages.push(msg);
    }
  });
  
  return { chatMessages, systemMessage };
};

export async function POST(req: Request) {
  console.log("-----------------------------------------");
  console.log("/api/chat POST request received");
  
  try {
    const body = await req.json();
    const { messages }: { messages: CoreMessage[] } = body;
    
    console.log("Received messages from client:", JSON.stringify(messages, null, 2));

    if (!messages || messages.length === 0) {
      console.log("No messages provided, returning 400");
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Get the user's latest message
    const userMessage = messages[messages.length - 1];
    if (userMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    let userQuery: string;
    if (typeof userMessage.content === 'string') {
      userQuery = userMessage.content;
    } else if (Array.isArray(userMessage.content)) {
      userQuery = userMessage.content
        .filter(part => part.type === 'text')
        .map(part => (part as { text: string }).text)
        .join(' ');
    } else {
      throw new Error('Unsupported user message content type');
    }

    // Perform semantic search based on the user's query
    const relevantContext = await performSemanticSearch(userQuery);

    // Create the augmented system message
    const baseSystemMessage = `You are a helpful and friendly assistant for our helpdesk system. Answer the user's question based on the following context from our knowledge base. Make your responses conversational and easy to understand, while maintaining accuracy.

Context from knowledge base:
${relevantContext}

Remember to:
1. Use a friendly, conversational tone
2. Break down complex information into simple, clear steps
3. Only use information from the provided context
4. Naturally mention the source articles (e.g., "Based on our guide about payments...")
5. If the context doesn't contain relevant information, politely admit it
6. Be concise but thorough
7. Use bullet points or numbered lists for steps when appropriate
8. Avoid technical jargon unless necessary, and explain it when you do use it

For example, instead of:
"[Source: 'Payment Guide'] The system accepts PayPal payments according to the documentation."

Say something like:
"According to our payment guide, you can easily pay using PayPal. Here's how to do it: [then list the steps]"`;

    // Prepare messages with the augmented system message
    const { chatMessages } = prepareMessagesForLLM(messages);
    console.log("Prepared Chat Messages for LLM:", JSON.stringify(chatMessages, null, 2));
    console.log("Prepared System Message for LLM:", baseSystemMessage);

    // Validate message format
    for (const msg of chatMessages) {
      if (!msg.role || msg.content == null) {
        console.error("Invalid message format (missing role or content):", msg);
        throw new Error(`Invalid message format: missing role or content`);
      }
      if (typeof msg.content !== 'string') {
        console.error("Message content is not a string:", msg);
        throw new Error(`Message content must be a string, got ${typeof msg.content}`);
      }
    }

    // Initialize the Gemini model
    const geminiModel = google('models/gemini-1.5-flash-latest');
    console.log("Gemini model instance created for:", 'models/gemini-1.5-flash-latest');

    console.log("Calling streamText...");
    
    const result = await streamText({
      model: geminiModel,
      messages: chatMessages,
      system: baseSystemMessage,
    });
    
    console.log("streamText call completed successfully");
    
    console.log("About to call result.toDataStreamResponse()");
    return result.toDataStreamResponse({
      getErrorMessage: (error: unknown) => {
        console.error("Error during stream processing by toDataStreamResponse:", error);
        if (error == null) return 'Unknown stream error occurred';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        return 'An unexpected stream error occurred';
      }
    });

  } catch (error: any) {
    console.error("!!!! ERROR in /api/chat route's main catch block !!!!");
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      cause: error.cause,
    });
    if (typeof error === 'object' && error !== null && error.cause) {
        console.error("Underlying cause:", error.cause);
    }

    let errorMessage = 'An unexpected error occurred in the API.';
    let errorStatus = 500;

    if (error.message) {
      if (error.message.includes('API key not valid') || 
          error.message.includes('API_KEY_INVALID') || 
          error.message.includes('permission denied') ||
          error.message.includes('invalid authentication credentials')) {
        errorMessage = "Invalid Google API Key. Please check your API key and ensure the Generative Language API is enabled.";
        errorStatus = 401;
      } else if (error.status === 429 || 
                 error.message.includes('quota') || 
                 error.message.includes('Resource has been exhausted') ||
                 error.message.includes('rate limit')) {
        errorMessage = "API quota exceeded or rate limit hit. Please check your Google Cloud Console usage.";
        errorStatus = 429;
      } else if (error.message.includes("Could not find model") || 
                 error.message.includes("MODEL_NAME_INVALID")) {
        errorMessage = `Invalid model specified. Please check if 'models/gemini-1.5-flash-latest' is available for your API key.`;
        errorStatus = 400;
      } else if (error.message.includes('safety')) {
        errorMessage = "Content was blocked by safety filters. Please try rephrasing your message.";
        errorStatus = 400;
      } else {
        errorMessage = `API Error: ${error.message}`;
      }
    }
    
    console.log(`Responding with error from CATCH BLOCK: ${errorMessage}, status: ${errorStatus}`);
    return Response.json({ error: errorMessage }, { status: errorStatus });
  }
}
