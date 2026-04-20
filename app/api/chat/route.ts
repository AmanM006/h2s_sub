import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { z } from 'zod';
import { logInfo, logError } from '@/lib/gcp-logger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Zod schema for strict input validation
const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  venueData: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      waitTime: z.number(),
      lat: z.number(),
      lng: z.number(),
    })
  ).optional().default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate and sanitize input with zod
    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      logWarning('Invalid chat request', { errors: parseResult.error.flatten() });
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { message, venueData } = parseResult.data;

    await logInfo('Chat request received', { messageLength: message.length });

    // Fetch wait times from Firebase
    let latestVenueData = venueData;
    try {
      const snapshot = await get(ref(db, 'venue/hotspots'));
      if (snapshot.exists()) {
        const data = snapshot.val();
        latestVenueData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      }
    } catch (error) {
      console.log("Firebase fetch failed in API route. Using provided venueData.", error);
    }

    const waitTimesString = latestVenueData && latestVenueData.length > 0 
      ? latestVenueData.map((item: any) => `${item.name} (${item.type}): Wait time ${item.waitTime} mins`).join(' | ')
      : "No live data available.";

    const systemPrompt = `You are a stadium navigation AI. You have access to the following live facilities and wait times: [${waitTimesString}]. If a user asks where to go, you MUST calculate the best option based on wait times. Give explicit directions based on the data. Never give generic answers like 'sounds good'.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt 
    });
    
    const result = await model.generateContent(message);
    const text = result.response.text();

    await logInfo('Chat response generated', { responseLength: text.length });

    return NextResponse.json({ reply: text });
  } catch (error) {
    await logError('Chat API Error', { error: String(error) });
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}

// Re-export for convenience — avoids circular import in tests
function logWarning(msg: string, meta?: Record<string, unknown>) {
  import('@/lib/gcp-logger').then(m => m.logWarning(msg, meta)).catch(() => console.warn(msg, meta));
}
