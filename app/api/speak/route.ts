import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || !String(text).trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; 

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!r.ok) {
      console.error(await r.text());
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    const audio = await r.arrayBuffer();

    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}
