"use client";
import { useEffect, useRef, useState } from "react";

type TutorResult = {
  verdict?: "correct" | "partial" | "incorrect";
  interrupt?: boolean;
  feedback?: string;
  question?: string;
  raw?: string;
};

export default function Home() {
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<TutorResult | null>(null);
  const [listening, setListening] = useState(false);
  const [checking, setChecking] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const voiceCountRef = useRef(0);
  const MAX_VOICES_PER_SESSION = 3;

  const CHECK_EVERY_MS = 4000;          // how often to evaluate while speaking
  const MIN_NEW_CHARS = 35;             // only check if we have this many new characters
  const MAX_CHECKS_PER_SESSION = 6;     // prevents burning quota during a single speaking session
  const COOLDOWN_AFTER_INTERRUPT_MS = 9000; // wait after interrupt before checking again

  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<number | null>(null);
  const lastSpokenRef = useRef<string>("");

  const lastCheckedLenRef = useRef<number>(0);
  const checksUsedRef = useRef<number>(0);
  const cooldownUntilRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);
  const autoRestartRef = useRef(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resetForRetry = () => {
    setTranscript("");
    lastCheckedLenRef.current = 0;
    checksUsedRef.current = 0;
    cooldownUntilRef.current = 0;
    lastSpokenRef.current = "";
  };
  const speakTutor = async (text: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error("Speak failed");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;

      setAvatarSpeaking(true);

      const done = () => {
        setAvatarSpeaking(false);
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onended = done;
      audio.onerror = done;

      audio.play();
    });
  };


  // ---------- Speech Recognition ----------
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Try Chrome on desktop.");
      return;
    }

    // If already listening, don't start a second instance
    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = "en-US";
    recognition.continuous = true;     // try to keep going through pauses
    recognition.interimResults = true; // get partial text while speaking

    recognition.onstart = () => {
      setListening(true);
      // reset counters for a new session
      lastCheckedLenRef.current = transcript.length;
      checksUsedRef.current = 0;
      cooldownUntilRef.current = 0;
      voiceCountRef.current = 0;
    };

    recognition.onresult = (event: any) => {
      // Collect final + interim parts
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk + " ";
        else interimText += chunk;
      }

      // Keep final text appended. Show interim in a "live" way.
      setTranscript((prev) => {
        // remove any previous interim marker
        const base = prev.replace(/\s*\[speaking\][\s\S]*$/, "").trim();
        const appended = (base ? base + " " : "") + finalText.trim();
        const withFinal = appended.trim();
        return interimText
          ? (withFinal ? withFinal + " " : "") + `[speaking] ${interimText}`.trim()
          : withFinal;
      });
    };

    recognition.onend = () => {
      // Browser may end after pauses; we treat it as stopped
      recognitionRef.current = null;
      setListening(false);
    };

    recognition.onerror = (e: any) => {
      console.log("Speech error:", e);
      recognitionRef.current = null;
      setListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
  };

  // ---------- AI check (call your route) ----------
  const checkWithAI = async (force = false) => {
    if (inFlightRef.current) return;

    if (!notes.trim()) {
      setResult({
        verdict: "partial",
        interrupt: false,
        feedback: "Paste your lecture notes first.",
        question: "What topic are we covering today?",
      });
      return;
    }

    if (!transcript.trim()) {
      setResult({
        verdict: "partial",
        interrupt: false,
        feedback: "Say something (or type it) so I can check it.",
        question: "Try explaining the concept in one sentence.",
      });
      return;
    }

    // Respect cooldown after an interrupt
    const now = Date.now();
    if (now < cooldownUntilRef.current) return;

    // Don't burn quota
    if (checksUsedRef.current >= MAX_CHECKS_PER_SESSION) return;

    // Only check when there is enough new speech since last check
    const cleanTranscript = transcript.replace(/\s*\[speaking\][\s\S]*$/, "").trim();
    const newLen = cleanTranscript.length;
    const delta = newLen - lastCheckedLenRef.current;

    if (!force && delta < MIN_NEW_CHARS) return;

    // Optional: only check at sentence boundaries (reduces spam)
    const lastChar = cleanTranscript.slice(-1);
    const looksLikeBoundary = [".", "?", "!"].includes(lastChar);
    if (!force && !looksLikeBoundary && delta < MIN_NEW_CHARS * 2) {
      // If no punctuation, require more new text
      return;
    }

    inFlightRef.current = true;
    setChecking(true);

    try {
      // send only the most recent chunk (last ~250 chars) for "live" checking
      const recentSnippet = cleanTranscript.slice(Math.max(0, newLen - 250));

      const res = await fetch("/api/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
          transcript: recentSnippet,
        }),
      });

      const data: TutorResult = await res.json();

      // update counters
      lastCheckedLenRef.current = newLen;
      checksUsedRef.current += 1;

      setResult(data);
      if (data?.verdict === "incorrect") {
        stopListening();

        cooldownUntilRef.current = Date.now() + COOLDOWN_AFTER_INTERRUPT_MS;

        const toSay = (data.feedback ?? "Hold on — that’s not quite right.").trim();

        if (toSay && toSay !== lastSpokenRef.current) {
          lastSpokenRef.current = toSay;

          if (voiceOn && voiceCountRef.current < MAX_VOICES_PER_SESSION) {
            voiceCountRef.current += 1;
            await speakTutor(toSay);
          }

          resetForRetry();

          // ⭐ AUTO RESTART MIC
          setTimeout(() => {
            startListening();
          }, 400);

        }
      }

    } catch (e) {
      // If anything goes wrong, don't crash UX
      setResult({
        verdict: "partial",
        interrupt: false,
        feedback: "Give me a second — try again in a moment.",
        question: "What are two key facts from the notes that support your answer?",
      });
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  };

  // ---------- Auto-check timer while listening ----------
  useEffect(() => {
    if (!listening || !liveMode) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (!intervalRef.current) {
      intervalRef.current = window.setInterval(() => {
        checkWithAI();
      }, CHECK_EVERY_MS);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [listening, notes, transcript]);

  // ui
  return (
    <main className="min-h-screen p-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">

        {/* LEFT: AVATAR (big) */}
        <div className="flex justify-center">
          <img
            src="/avatar.png"
            alt="Tutor avatar"
            className={`w-[420px] max-w-full transition-transform duration-150 ${
              avatarSpeaking ? "scale-[1.03]" : "scale-100"
            }`}
          />
        </div>

        {/* RIGHT: APP UI */}
        <div>
          <h1 className="text-3xl font-bold">AI Speaking Tutor</h1>

          <textarea
            placeholder="Paste lecture notes here..."
            className="mt-6 w-full h-40 p-3 border rounded"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <textarea
            placeholder="Transcript (auto-filled when you speak)..."
            className="mt-4 w-full h-28 p-3 border rounded"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => setVoiceOn((v) => !v)}
              className="px-4 py-2 bg-orange-600 text-white rounded"
            >
              Tutor Voice: {voiceOn ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => {
                if (!notes.trim()) {
                  setResult({
                    verdict: "partial",
                    interrupt: false,
                    feedback: "Please paste your lecture notes first.",
                    question: "What topic are we covering today?",
                  });
                  return;
                }
                startListening();
              }}
              disabled={listening}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
            >
              {listening ? "Listening..." : "Speak Answer"}
            </button>

            <button
              onClick={stopListening}
              disabled={!listening}
              className="px-4 py-2 bg-gray-700 text-white rounded disabled:opacity-50"
            >
              Stop
            </button>

            <button
              onClick={() => checkWithAI(true)}
              disabled={checking || !notes.trim() || !transcript.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            >
              {checking ? "Checking..." : "Check Now"}
            </button>

            <button
              onClick={() => setLiveMode((v) => !v)}
              className="px-4 py-2 bg-purple-600 text-white rounded"
            >
              Live interrupt: {liveMode ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => {
                if (!voiceOn) {
                  setResult({
                    verdict: "partial",
                    interrupt: false,
                    feedback:
                      "Turn Tutor Voice ON to test ElevenLabs without burning credits accidentally.",
                    question: "Ready when you are.",
                  });
                  return;
                }
                speakTutor(
                  "Hold on. That is not correct. Photosynthesis happens in chloroplasts."
                );
              }}
              className="px-4 py-2 bg-orange-500 text-white rounded"
            >
              Test Tutor Voice
            </button>

            <button
              onClick={async () => {
                stopListening();

                // ✅ always reset transcript + counters for a clean retry
                resetForRetry();

                setResult({
                  verdict: "incorrect",
                  interrupt: true,
                  feedback: "Hold on — that’s incorrect. Photosynthesis happens in chloroplasts.",
                  question: "Where does photosynthesis occur?",
                });
                setAvatarSpeaking(true);
                setTimeout(() => setAvatarSpeaking(false), 600);


                // ✅ only speak (and animate) if voice is ON
                if (voiceOn) {
                  await speakTutor(
                    "Hold on — that’s incorrect. Photosynthesis happens in chloroplasts."
                  );
                }

                // ✅ restart mic (give it a tiny moment)
                setTimeout(() => {
                  startListening();
                }, 500);
              }}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Simulate Interrupt
            </button>

          </div>

          {result && (
            <div className="mt-6 p-4 border rounded">
              <p>
                <b>Verdict:</b> {result.verdict ?? "unknown"}
              </p>
              <p className="mt-2">
                <b>Interrupt:</b>{" "}
                {String(result.interrupt ?? (result.verdict === "incorrect"))}
              </p>
              <p className="mt-2">
                <b>Feedback:</b> {result.feedback ?? result.raw ?? ""}
              </p>
              <p className="mt-2">
                <b>Question:</b> {result.question ?? ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );

}