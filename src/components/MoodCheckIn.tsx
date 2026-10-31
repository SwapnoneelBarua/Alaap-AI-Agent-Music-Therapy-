"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export type MoodPoint = { valence: number; arousal: number; emotion: string };
type MoodCheckInProps = { onComplete?: (mood: MoodPoint) => void; initialMood?: MoodPoint };

const emotions = ["Calm", "Hopeful", "Joyful", "Tender", "Tired", "Anxious", "Heavy", "Frustrated"];

function describeMood(valence: number, arousal: number) {
  if (valence >= 0 && arousal >= 0) return "Upbeat & energized";
  if (valence >= 0) return "Calm & at ease";
  if (arousal >= 0) return "Tense or activated";
  return "Low energy or heavy";
}

export default function MoodCheckIn({ onComplete, initialMood }: MoodCheckInProps) {
  const [valence, setValence] = useState(initialMood?.valence ?? 12);
  const [arousal, setArousal] = useState(initialMood?.arousal ?? -8);
  const [emotion, setEmotion] = useState(initialMood?.emotion ?? "Calm");
  const moodDescription = useMemo(() => describeMood(valence, arousal), [valence, arousal]);
  const x = `${((valence + 100) / 2).toFixed(1)}%`;
  const y = `${((100 - arousal) / 2).toFixed(1)}%`;

  function updateFromPointer(clientX: number, clientY: number, bounds: DOMRect) {
    const nextValence = Math.round(((clientX - bounds.left) / bounds.width) * 200 - 100);
    const nextArousal = Math.round(100 - ((clientY - bounds.top) / bounds.height) * 200);
    setValence(Math.max(-100, Math.min(100, nextValence)));
    setArousal(Math.max(-100, Math.min(100, nextArousal)));
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center" aria-labelledby="checkin-title">
      <div className="max-w-lg">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#71918a]">01 · Mood check-in</p>
        <h1 id="checkin-title" className="text-4xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">How are you arriving <span className="font-serif italic text-[#43877a]">right now?</span></h1>
        <p className="mt-5 max-w-md text-base leading-7 text-[#6d8580]">There’s no right answer. Take a breath, then place yourself on the map. You can change this at any time.</p>
        <div className="mt-8 rounded-3xl border border-white/80 bg-white/70 p-5 shadow-[0_16px_48px_-32px_rgba(31,74,66,0.35)] backdrop-blur-sm">
          <p className="text-sm font-medium text-[#345c56]">Any word feel close?</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Choose an emotion">
            {emotions.map((word) => (
              <button key={word} type="button" onClick={() => setEmotion(word)} aria-pressed={emotion === word}
                className={`rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28766e] ${emotion === word ? "border-[#28766e] bg-[#28766e] text-white" : "border-[#e0e9e2] bg-white text-[#637b75] hover:border-[#8fb8aa]"}`}>
                {word}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-xs leading-5 text-[#82958e]">This is a reflection tool, not a diagnosis or a substitute for professional care.</p>
      </div>

      <div className="rounded-[2rem] border border-white bg-white/75 p-5 shadow-[0_24px_70px_-42px_rgba(29,73,66,0.42)] sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><p className="text-sm font-medium text-[#315b54]">Your emotional landscape</p><p className="mt-1 text-xs text-[#849791]">Move the dot to where you feel</p></div>
          <span className="rounded-full bg-[#edf5ef] px-3 py-1.5 text-xs font-medium text-[#4b7c70]">Right now</span>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[510px] overflow-hidden rounded-[1.5rem] border border-[#e2ebe4] bg-[#f8faf6]" aria-label="Mood map with valence and arousal axes">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            <div className="bg-[#edf3ec]"/><div className="bg-[#edf6ef]"/><div className="bg-[#f4f0e9]"/><div className="bg-[#f5f2e9]"/>
          </div>
          <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-[#c5d7ce]" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[#c5d7ce]" />
          <span className="absolute left-3 top-3 text-[10px] font-medium text-[#778d84] sm:left-5 sm:top-5">TENSE · HIGH ENERGY</span>
          <span className="absolute right-3 top-3 text-right text-[10px] font-medium text-[#778d84] sm:right-5 sm:top-5">ENERGIZED · POSITIVE</span>
          <span className="absolute bottom-3 left-3 text-[10px] font-medium text-[#778d84] sm:bottom-5 sm:left-5">LOW · UNPLEASANT</span>
          <span className="absolute bottom-3 right-3 text-right text-[10px] font-medium text-[#778d84] sm:bottom-5 sm:right-5">CALM · PLEASANT</span>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold tracking-[0.16em] text-[#9aaca3] [writing-mode:vertical-rl]">AROUSAL</div>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-[0.16em] text-[#9aaca3]">VALENCE</div>
          <motion.div className="pointer-events-none absolute z-10" animate={{ left: x, top: y }} transition={{ type: "spring", stiffness: 150, damping: 20 }} style={{ transform: "translate(-50%, -50%)" }}>
            <div className="relative grid h-10 w-10 place-items-center rounded-full border-[5px] border-white bg-[#43877a] shadow-[0_4px_18px_rgba(31,94,81,0.35)] sm:h-12 sm:w-12" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-white" /></div>
          </motion.div>
          <span className="sr-only" aria-live="polite">Current mood position: valence {valence}, arousal {arousal}; {moodDescription}.</span>
          <input aria-label={`Valence: ${valence}, negative to positive`} type="range" min="-100" max="100" value={valence} onChange={(event) => setValence(Number(event.target.value))}
            className="absolute inset-x-4 bottom-8 z-20 h-8 cursor-ew-resize opacity-0 focus-visible:opacity-100 focus-visible:accent-[#28766e]" />
          <input aria-label={`Arousal: ${arousal}, low to high`} type="range" min="-100" max="100" value={arousal} onChange={(event) => setArousal(Number(event.target.value))}
            className="absolute inset-y-8 right-2 z-20 w-8 cursor-ns-resize opacity-0 [writing-mode:vertical-lr] focus-visible:opacity-100 focus-visible:accent-[#28766e]" />
          <div className="absolute inset-0 z-0 cursor-crosshair" onPointerDown={(event) => {
            updateFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          }} onPointerMove={(event) => {
            if (event.buttons === 1) updateFromPointer(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
          }} />
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-[#e9efea] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-[#315b54]">{emotion} <span className="font-normal text-[#849791]">· {moodDescription}</span></p><p className="mt-1 text-xs text-[#91a29b]">Valence {valence} · Arousal {arousal}</p></div>
          <button type="button" onClick={() => onComplete?.({ valence, arousal, emotion })} className="rounded-full bg-[#28766e] px-6 py-3 text-sm font-medium text-white shadow-[0_8px_20px_-10px_#28766e] transition hover:bg-[#205f59] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28766e]">Continue gently <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </section>
  );
}
