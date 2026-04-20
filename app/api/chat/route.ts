import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/firebase';
import { ref, get } from 'firebase/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { message, venueData } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Fetch wait times from Firebase
    let latestVenueData = venueData || [];
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

    return NextResponse.json({ reply: text });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
