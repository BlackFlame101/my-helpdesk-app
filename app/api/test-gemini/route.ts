// app/api/test-gemini/route.ts

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function GET() {
  try {
    console.log("Testing Gemini API connection...");
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("Missing API key configuration");
      return Response.json(
        { success: false, message: 'Service configuration error' }, 
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
    // Log detailed error information server-side
    console.error("Gemini API test failed:", {
      name: error.name,
      message: error.message,
      status: error.status,
      cause: error.cause,
      stack: error.stack
    });
    
    // Return a generic error message to the client
    return Response.json({
      success: false,
      message: 'An error occurred while testing the API connection'
    }, { 
      status: error.status === 401 ? 401 : 500 // Only preserve 401 status for auth errors
    });
  }
}