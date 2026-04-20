export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';
import { z } from 'zod';
import { logInfo, logError, logWarning } from '@/lib/gcp-logger';
import { FIREBASE_HOTSPOTS_PATH, GEMINI_MODEL, CHAT_LIMITS, VENUE_COPILOT_SYSTEM_PROMPT } from '@/lib/constants';

/** Google Generative AI client instance */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/** Zod schema for strict input validation with length limits to prevent payload attacks */
const chatRequestSchema = z.object({
  message: z.string()
    .min(CHAT_LIMITS.MIN_MESSAGE_LENGTH, 'Message cannot be empty')
    .max(CHAT_LIMITS.MAX_MESSAGE_LENGTH, `Message cannot exceed ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} characters`),
  venueData: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(200),
      type: z.string().max(50),
      waitTime: z.number().min(0).max(999),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
  ).max(50).optional().default([]),
});

/** Represents a parsed venue data item from the client or Firebase */
interface VenueDataItem {
  id: string;
  name: string;
  type: string;
  waitTime: number;
  lat: number;
  lng: number;
}

/**
 * POST handler for the chat API route.
 * Validates input with zod, fetches latest venue data from Firebase,
 * constructs a spatially-aware system prompt, and generates a response
 * using the Gemini 2.5 Flash model.
 *
 * @param req - The incoming Next.js request object
 * @returns JSON response with the AI-generated reply or an error
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    // Validate and sanitize input with zod
    const parseResult = chatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      await logWarning('Invalid chat request', { errors: parseResult.error.flatten() });
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { message, venueData } = parseResult.data;

    await logInfo('Chat request received', { messageLength: message.length });

    // Fetch latest wait times from Firebase (fallback to client-provided data)
    let latestVenueData: VenueDataItem[] = venueData;
    try {
      const snapshot = await get(ref(db, FIREBASE_HOTSPOTS_PATH));
      if (snapshot.exists()) {
        const data = snapshot.val();
        latestVenueData = Object.keys(data).map(key => ({ id: key, ...data[key] }));
      }
    } catch (error) {
      console.log("Firebase fetch failed in API route. Using provided venueData.", error);
    }

    /** Format venue data into a human-readable string for the AI prompt */
    const waitTimesString: string = latestVenueData && latestVenueData.length > 0
      ? latestVenueData.map((item: VenueDataItem) => `${item.name} (${item.type}): Wait time ${item.waitTime} mins`).join(' | ')
      : "No live data available.";

    const systemPrompt = VENUE_COPILOT_SYSTEM_PROMPT(waitTimesString);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent(message);
    const text: string = result.response.text();

    await logInfo('Chat response generated', { responseLength: text.length });

    return NextResponse.json({ reply: text });
  } catch (error) {
    await logError('Chat API Error', { error: String(error) });
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
