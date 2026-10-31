import MoodCheckIn from "@/components/MoodCheckIn";
import AlaapSession from "@/components/AlaapSession";

export default function Home() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 sm:py-12">
      <header className="mx-auto mb-10 flex max-w-6xl items-center justify-between">
        <a href="#home" className="flex items-center gap-3" aria-label="Alaap home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#28766e] text-lg text-white">♫</span>
          <span className="text-xl font-semibold tracking-tight">alaap</span>
        </a>
        <span className="rounded-full border border-[#dce7de] bg-white/70 px-4 py-2 text-xs text-[#668079]">A gentle space to check in</span>
      </header>
      <AlaapSession />
    </main>
  );
}
