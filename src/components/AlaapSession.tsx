"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MoodCheckIn, { MoodPoint } from "@/components/MoodCheckIn";

const API = process.env.NEXT_PUBLIC_ALAAP_API ?? "http://localhost:8000";
type Message = { role: "assistant" | "user"; content: string; safety?: boolean; sources?: string[]; tracks?: Track[] };
type Track = { id: string; name: string; artist: string; url: string; audio_url: string; license_url: string; image?: string; phase: string };
type Evaluation = { before: MoodPoint; after: MoodPoint; delta: { valence: number; arousal: number } };
type Phase = "checkin" | "chat" | "evaluation" | "complete";

function MoodSummary({ evaluation }: { evaluation: Evaluation }) {
  const before = evaluation.before;
  const after = evaluation.after;
  const deltaLabel = (value: number) => value > 0 ? `+${value}` : `${value}`;
  return (
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      {[{ title: "Before", mood: before, color: "#77998b" }, { title: "After", mood: after, color: "#28766e" }].map((item) => (
        <div key={item.title} className="rounded-3xl border border-[#e3ece5] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#82958e]">{item.title}</p>
          <p className="mt-2 text-lg font-medium text-[#315b54]">{item.mood.emotion}</p>
          <p className="mt-1 text-sm text-[#849791]">Valence {item.mood.valence} · Arousal {item.mood.arousal}</p>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-[#eaf0eb]">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(2, item.mood.valence + 100) / 2}%` }} className="h-full rounded-full" style={{ backgroundColor: item.color }} />
          </div>
        </div>
      ))}
      <div className="rounded-3xl bg-[#edf5ef] p-5 sm:col-span-2">
        <p className="text-sm font-medium text-[#315b54]">Your check-in shift</p>
        <p className="mt-2 text-sm text-[#637b75]">Valence {deltaLabel(evaluation.delta.valence)} · Arousal {deltaLabel(evaluation.delta.arousal)}</p>
        <p className="mt-2 text-xs leading-5 text-[#849791]">This reflects your own before-and-after check-ins. It does not establish treatment effectiveness.</p>
      </div>
    </div>
  );
}

export default function AlaapSession() {
  const [phase, setPhase] = useState<Phase>("checkin");
  const [baseline, setBaseline] = useState<MoodPoint | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [intervention, setIntervention] = useState<"guided_listening" | "songwriting">("guided_listening");
  const [goal, setGoal] = useState<"settle" | "process" | "lift">("settle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  async function begin(mood: MoodPoint) {
    setBusy(true); setError(""); setBaseline(mood);
    try {
      const response = await fetch(`${API}/api/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not start a session.");
      setSessionId(data.session_id);
      setMessages([{ role: "assistant", content: data.assistant_message }]);
      setPhase("chat");
    } catch (caught) {
      setError(caught instanceof Error ? `${caught.message} Start the FastAPI server on port 8000 and try again.` : "Could not reach the local API.");
    } finally { setBusy(false); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !sessionId || busy) return;
    setDraft(""); setError(""); setMessages((current) => [...current, { role: "user", content: message }]); setBusy(true);
    try {
      const response = await fetch(`${API}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message, intervention, goal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not send your message.");
      const recommendedTracks: Track[] = data.tracks ?? [];
      if (recommendedTracks.length) setTracks(recommendedTracks);
      setMessages((current) => [...current, {
        role: "assistant", content: data.assistant_message, safety: data.safety_mode,
        sources: data.sources, tracks: recommendedTracks,
      }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reach the local API.");
      setMessages((current) => current.slice(0, -1));
      setDraft(message);
    } finally { setBusy(false); }
  }

  async function findMusic() {
    if (!baseline || tracksLoading) return;
    setTracksLoading(true); setError("");
    try {
      const response = await fetch(`${API}/api/music/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: baseline, goal }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Jamendo search failed.");
      setTracks(data.tracks);
      if (!data.tracks.length) setError("No tracks came back for that search. Try another mood word.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Jamendo is not available."); }
    finally { setTracksLoading(false); }
  }

  async function finish(mood: MoodPoint) {
    if (!sessionId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API}/api/sessions/evaluation`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, mood }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not save the check-in.");
      setEvaluation(data); setPhase("complete");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the check-in."); }
    finally { setBusy(false); }
  }

  function reset() {
    setPhase("checkin"); setBaseline(null); setSessionId(null); setMessages([]); setTracks([]); setEvaluation(null); setError("");
  }

  return (
    <div className="mx-auto max-w-6xl">
      {phase !== "complete" && <nav className="mb-7 flex items-center gap-2 text-xs text-[#849791]" aria-label="Session steps">
        {["Check-in", "Choose a focus", "Reflect"].map((label, index) => {
          const active = (phase === "checkin" && index === 0) || (phase === "chat" && index === 1) || (phase === "evaluation" && index === 2);
          return <span key={label} className={`rounded-full px-3 py-1.5 ${active ? "bg-[#dcece2] font-semibold text-[#3a7065]" : ""}`}>{String(index + 1).padStart(2, "0")} · {label}</span>;
        })}
      </nav>}

      <AnimatePresence mode="wait">
        {phase === "checkin" && <motion.div key="checkin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <MoodCheckIn onComplete={begin} />
        </motion.div>}

        {phase === "chat" && <motion.section key="chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white/80 shadow-[0_24px_70px_-42px_rgba(29,73,66,0.42)]">
            <header className="flex items-center justify-between border-b border-[#e9efea] px-5 py-4 sm:px-7">
              <div><p className="font-medium text-[#315b54]">Alaap reflection</p><p className="mt-1 text-xs text-[#849791]">A gentle conversation, at your pace</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#edf5ef] text-xl text-[#43877a]">♫</span>
            </header>
            <div className="max-h-[52vh] min-h-[320px] space-y-4 overflow-y-auto px-4 py-5 sm:px-7" aria-live="polite" aria-label="Conversation">
              {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <article className={`max-w-[88%] rounded-3xl px-4 py-3.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#28766e] text-white" : "rounded-bl-md bg-[#f0f5f0] text-[#385f58]"}`}>
                  {message.safety && <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a4513e]">Safety support</p>}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {Boolean(message.sources?.length) && <p className="mt-3 border-t border-[#dce8df] pt-2 text-[10px] leading-4 text-[#849791]">Background references: {message.sources?.join(" · ")}</p>}
                  {Boolean(message.tracks?.length) && <div className="mt-3 space-y-3" aria-label="Jamendo music suggestions">
                    {message.tracks?.map((track) => <div key={`${track.phase}-${track.id}`} className="overflow-hidden rounded-2xl border border-[#dce8df] bg-white p-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#82958e]">{track.phase}</p>
                      <p className="mt-1 text-xs font-semibold text-[#315b54]">{track.name}</p>
                      <p className="text-[10px] text-[#849791]">by {track.artist} · Jamendo</p>
                      <audio aria-label={`Play ${track.name} by ${track.artist}`} controls preload="none" src={track.audio_url} className="mt-2 h-9 w-full" />
                      <div className="mt-1 flex gap-3 text-[10px]">
                        <a href={track.url} target="_blank" rel="noreferrer" className="text-[#43877a] underline">Track</a>
                        {track.license_url && <a href={track.license_url} target="_blank" rel="noreferrer" className="text-[#6d8580] underline">License</a>}
                      </div>
                    </div>)}
                  </div>}
                </article>
              </div>)}
              {busy && <div className="text-xs text-[#849791]" role="status">Alaap is taking a moment…</div>}
              <div ref={chatEnd} />
            </div>
            <form onSubmit={sendMessage} className="border-t border-[#e9efea] p-4 sm:px-7 sm:py-5">
              <label className="sr-only" htmlFor="chat-input">Your message</label>
              <div className="flex gap-2 rounded-2xl border border-[#e0e9e2] bg-[#fbfcfa] p-2 focus-within:border-[#8fb8aa]">
                <textarea id="chat-input" rows={2} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Share whatever feels okay…" className="max-h-32 min-h-12 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-[#315b54] outline-none placeholder:text-[#9aaca3]" />
                <button disabled={busy || !draft.trim()} className="self-end rounded-xl bg-[#28766e] px-4 py-2.5 text-sm text-white transition hover:bg-[#205f59] disabled:cursor-not-allowed disabled:opacity-45">Send</button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-[#93a39c]">Session text stays in local server memory. Chat replies use your local Ollama model. Jamendo receives the selected mood word and goal for track search.</p>
            </form>
          </div>

          <aside className="space-y-5">
            <div className="rounded-[2rem] border border-white bg-white/75 p-5 shadow-[0_20px_60px_-42px_rgba(29,73,66,0.4)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#82958e]">What would feel useful?</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[{ id: "settle", label: "Settle" }, { id: "process", label: "Process" }, { id: "lift", label: "Lift" }].map((option) => <button key={option.id} onClick={() => setGoal(option.id as typeof goal)} aria-pressed={goal === option.id} className={`rounded-full border px-3 py-2 text-xs ${goal === option.id ? "border-[#83b3a1] bg-[#edf5ef] font-semibold text-[#3d766a]" : "border-[#e5ece6] text-[#718780]"}`}>{option.label}</button>)}
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#82958e]">Choose a way in</p>
              <div className="mt-4 grid gap-2">
                <button onClick={() => setIntervention("guided_listening")} className={`rounded-2xl border p-4 text-left ${intervention === "guided_listening" ? "border-[#83b3a1] bg-[#edf5ef]" : "border-[#e5ece6] bg-white"}`} aria-pressed={intervention === "guided_listening"}>
                  <span className="block text-sm font-medium text-[#315b54]">Guided listening</span><span className="mt-1 block text-xs leading-5 text-[#849791]">Use a track as a backdrop for noticing and imagery.</span>
                </button>
                <button onClick={() => setIntervention("songwriting")} className={`rounded-2xl border p-4 text-left ${intervention === "songwriting" ? "border-[#83b3a1] bg-[#edf5ef]" : "border-[#e5ece6] bg-white"}`} aria-pressed={intervention === "songwriting"}>
                  <span className="block text-sm font-medium text-[#315b54]">Write it out</span><span className="mt-1 block text-xs leading-5 text-[#849791]">Co-write original lines to put words around a feeling.</span>
                </button>
              </div>
              <button onClick={findMusic} disabled={tracksLoading} className="mt-4 w-full rounded-full border border-[#bed6c9] px-5 py-3 text-sm font-medium text-[#3d766a] transition hover:bg-[#f0f7f1] disabled:opacity-50">{tracksLoading ? "Finding music…" : "Find music on Jamendo"}</button>
              <p className="mt-3 text-[10px] leading-4 text-[#93a39c]">Track search is a discovery aid. You decide what feels right; music can affect people differently.</p>
            </div>

            {tracks.length > 0 && <div className="space-y-3">
              <p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#82958e]">A few possibilities</p>
              {tracks.map((track) => <div key={`${track.phase}-${track.id}`} className="overflow-hidden rounded-3xl border border-white bg-white shadow-sm">
                <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#82958e]">{track.phase}</p>
                <div className="flex items-center gap-3 p-3">
                  {track.image ? <img src={track.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#edf5ef] text-lg text-[#43877a]">♫</div>}
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#315b54]">{track.name}</p><p className="truncate text-xs text-[#849791]">by {track.artist} · Jamendo</p></div>
                  <a href={track.url} target="_blank" rel="noreferrer" className="text-xs text-[#43877a] underline">Track</a>
                </div>
                <div className="px-4 pb-3"><audio aria-label={`Play ${track.name} by ${track.artist}`} controls preload="none" src={track.audio_url} className="h-10 w-full" />
                  {track.license_url && <a href={track.license_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] text-[#6d8580] underline">View track license</a>}
                </div>
              </div>)}
            </div>}

            <button onClick={() => setPhase("evaluation")} className="w-full rounded-full bg-[#28766e] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-[#205f59]">Finish with a check-in <span aria-hidden="true">→</span></button>
            {error && <p role="alert" className="rounded-2xl border border-[#efd1c8] bg-[#fff7f3] px-4 py-3 text-sm text-[#8f4d40]">{error}</p>}
          </aside>
        </motion.section>}

        {phase === "evaluation" && <motion.div key="evaluation" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <MoodCheckIn key={`post-${baseline?.valence}-${baseline?.arousal}`} initialMood={baseline ?? undefined} onComplete={finish} />
          {error && <p role="alert" className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#efd1c8] bg-[#fff7f3] px-4 py-3 text-sm text-[#8f4d40]">{error}</p>}
          <button onClick={() => setPhase("chat")} className="mx-auto mt-5 block text-sm text-[#6d8580] underline underline-offset-4">Back to conversation</button>
        </motion.div>}

        {phase === "complete" && evaluation && <motion.section key="complete" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-3xl rounded-[2rem] border border-white bg-white/80 p-6 shadow-[0_24px_70px_-42px_rgba(29,73,66,0.42)] sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#71918a]">Session reflection</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight text-[#183b3b]">Thank you for checking in with yourself.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#6d8580]">Whatever changed or stayed the same, you gave yourself a moment to notice.</p>
          <MoodSummary evaluation={evaluation} />
          <button onClick={reset} className="mt-7 rounded-full bg-[#28766e] px-6 py-3 text-sm font-medium text-white hover:bg-[#205f59]">Start a new check-in</button>
        </motion.section>}
      </AnimatePresence>
      {error && phase === "checkin" && <p role="alert" className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[#efd1c8] bg-[#fff7f3] px-4 py-3 text-sm text-[#8f4d40]">{error}</p>}
      {busy && phase === "evaluation" && <p role="status" className="mt-3 text-center text-xs text-[#849791]">Saving your check-in…</p>}
    </div>
  );
}
