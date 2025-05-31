// app/api/test-gemini/route.ts

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function GET() {
  try {
    console.log("Testing Gemini API connection...");
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set' }, 
        { status: 500 }
      );
    }

    console.log("API Key is present, testing connection...");
    
    const model = google('models/gemini-1.5-flash-latest');
    
    const result = await generateText({
      model,
      prompt: 'Say hello in one word',
    });

    console.log("Test successful! Response:", result.text);
    
    return Response.json({ 
      success: true, 
      message: 'Gemini API is working correctly',
      response: result.text,
      usage: result.usage
    });

  } catch (error: any) {
    console.error("Gemini API test failed:", error);
    
    return Response.json({
      success: false,
      error: error.message || 'Unknown error',
      details: {
        name: error.name,
        message: error.message,
        status: error.status,
        cause: error.cause
      }
    }, { status: 500 });
  }
}