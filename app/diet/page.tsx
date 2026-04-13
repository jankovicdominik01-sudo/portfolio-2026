"use client";

import { useState, useEffect } from "react";
import { TrendingDown, Plus, Minus, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Types ─── */
interface DayData {
  weight: string;
  water: number;
  mood: string;
  note: string;
}

/* ─── Constants ─── */
const STORAGE_KEY = "diet-logger-17days-v2";
const START_DATE_KEY = "diet-logger-start-date-v2";

const MOODS = [
  { emoji: "😴", label: "Vyčerpaný/á" },
  { emoji: "😐", label: "Neutrálny/a" },
  { emoji: "😊", label: "Dobre" },
  { emoji: "😄", label: "Skvelo" },
  { emoji: "💪", label: "Silný/á" },
];

const emptyDay = (): DayData => ({ weight: "", water: 0, mood: "", note: "" });

/* ─── Component ─── */
export default function DietPage() {
  const [days, setDays] = useState<DayData[]>(() => {
    if (typeof window === "undefined") return Array.from({ length: 17 }, emptyDay);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return Array.from({ length: 17 }, emptyDay);
  });

  const [startDate, setStartDate] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(START_DATE_KEY) || "";
  });

  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [eduOpen, setEduOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
    } catch {}
  }, [days]);

  useEffect(() => {
    try {
      localStorage.setItem(START_DATE_KEY, startDate);
    } catch {}
  }, [startDate]);

  /* ─── Helpers ─── */
  const updateDay = (i: number, field: keyof DayData, value: string | number) =>
    setDays((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d))
    );

  const adjustWater = (i: number, delta: number) =>
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === i ? { ...d, water: Math.max(0, d.water + delta) } : d
      )
    );

  const getDateLabel = (i: number) => {
    if (!startDate) return null;
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" });
  };

  const filledWeights = days.map((d) => parseFloat(d.weight)).filter((w) => !isNaN(w) && w > 0);
  const firstW = filledWeights[0] ?? null;
  const lastW = filledWeights.length > 1 ? filledWeights[filledWeights.length - 1] : null;
  const totalLoss = firstW !== null && lastW !== null ? (firstW - lastW).toFixed(1) : null;
  const daysCompleted = days.filter((d) => d.weight || d.mood || d.note).length;

  return (
    <div className="min-h-screen cursor-auto">
      {/* ── HEADER ── */}
      <header className="px-5 md:px-14 pt-14 pb-10 border-b border-white/5">
        <p className="text-green-400 font-mono text-xs tracking-[0.25em] uppercase mb-5">
          // 17-dnovy program
        </p>
        <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-[-0.04em] leading-[0.9] mb-5">
          DIETNY{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            LOGER
          </span>
        </h1>
        <p className="text-neutral-500 text-lg md:text-xl font-light max-w-xl">
          Sleduj vahu, vodu a naladu. Kazdy den sa pocita.
        </p>
      </header>

      {/* ── STATS BAR ── */}
      <div className="px-5 md:px-14 py-7 flex flex-col sm:flex-row gap-6 sm:items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-5">
          <div className="p-3.5 bg-green-500/10 rounded-2xl border border-green-500/20 shrink-0">
            <TrendingDown className="text-green-400 w-6 h-6" />
          </div>
          <div>
            <p className="text-neutral-600 text-xs uppercase tracking-[0.15em] mb-1">
              Celkovy ubytok
            </p>
            <p className="text-4xl md:text-5xl font-black tracking-[-0.03em] leading-none">
              {totalLoss !== null ? (
                <span className={parseFloat(totalLoss) >= 0 ? "text-green-400" : "text-red-400"}>
                  {parseFloat(totalLoss) >= 0 ? "−" : "+"}
                  {Math.abs(parseFloat(totalLoss))} kg
                </span>
              ) : (
                <span className="text-neutral-800">— kg</span>
              )}
            </p>
          </div>
          <div className="hidden sm:block w-px h-12 bg-white/5 mx-2" />
          <div className="hidden sm:block">
            <p className="text-neutral-600 text-xs uppercase tracking-[0.15em] mb-1">Zaznamenaných</p>
            <p className="text-2xl font-black tracking-tight text-white/80">
              {daysCompleted}<span className="text-neutral-600 font-medium">/17</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-neutral-600 text-sm whitespace-nowrap">Start:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors cursor-auto"
            style={{ colorScheme: "dark" }}
          />
        </div>
      </div>

      {/* ── PHASE LEGEND ── */}
      <div className="px-5 md:px-14 py-4 flex flex-wrap gap-6 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-sm text-neutral-500">Jablcna faza — 1.–9. den</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-sm text-neutral-500">800 kcal faza — 10.–17. den</span>
        </div>
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className="hidden lg:block px-5 md:px-14 py-10">
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white/[0.02]">
                {["Den", "Vaha (kg)", "Voda", "Nalada", "Poznamka"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-left text-[11px] font-medium text-neutral-600 uppercase tracking-[0.2em] first:rounded-tl-2xl last:rounded-tr-2xl"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day, i) => {
                const apple = i < 9;
                const rowBg = apple
                  ? "bg-green-950/[0.08] hover:bg-green-950/[0.16]"
                  : "bg-blue-950/[0.08] hover:bg-blue-950/[0.16]";
                const accent = apple ? "text-green-400" : "text-blue-400";
                const borderL = apple
                  ? "border-l-2 border-l-green-600/30"
                  : "border-l-2 border-l-blue-600/30";
                const dateLabel = getDateLabel(i);

                return (
                  <tr
                    key={i}
                    className={`border-b border-white/[0.04] transition-colors ${rowBg} ${borderL}`}
                  >
                    {/* Day */}
                    <td className="px-5 py-4 w-20">
                      <span className={`font-black text-2xl leading-none ${accent}`}>
                        {i + 1}
                      </span>
                      {dateLabel && (
                        <span className="text-neutral-600 text-xs block mt-1">{dateLabel}</span>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-5 py-4">
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={day.weight}
                        onChange={(e) => updateDay(i, "weight", e.target.value)}
                        placeholder="0.0"
                        className="w-28 bg-black/40 border border-white/[0.07] rounded-xl px-4 py-2.5 text-white text-sm font-medium focus:outline-none focus:border-white/20 placeholder-neutral-700 transition-colors cursor-auto"
                      />
                    </td>

                    {/* Water */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => adjustWater(i, -1)}
                          className="w-9 h-9 rounded-xl bg-black/40 border border-white/[0.07] flex items-center justify-center text-neutral-500 hover:text-white hover:border-white/20 transition-all cursor-auto active:scale-95"
                        >
                          <Minus size={12} />
                        </button>
                        <div className="w-20 text-center">
                          <div className="text-white font-bold text-sm leading-tight">
                            {day.water} <span className="text-xs opacity-60">poharov</span>
                          </div>
                          <div className="text-neutral-600 text-xs mt-0.5">
                            {(day.water * 0.25).toFixed(2)} l
                          </div>
                        </div>
                        <button
                          onClick={() => adjustWater(i, 1)}
                          className="w-9 h-9 rounded-xl bg-black/40 border border-white/[0.07] flex items-center justify-center text-neutral-500 hover:text-white hover:border-white/20 transition-all cursor-auto active:scale-95"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Mood */}
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5">
                        {MOODS.map((m) => (
                          <button
                            key={m.emoji}
                            title={m.label}
                            onClick={() =>
                              updateDay(i, "mood", day.mood === m.emoji ? "" : m.emoji)
                            }
                            className={`w-9 h-9 rounded-xl text-base transition-all cursor-auto ${
                              day.mood === m.emoji
                                ? "bg-white/15 scale-110 shadow-lg"
                                : "opacity-30 hover:opacity-70 hover:bg-white/5"
                            }`}
                          >
                            {m.emoji}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Note */}
                    <td className="px-5 py-4">
                      <input
                        type="text"
                        value={day.note}
                        onChange={(e) => updateDay(i, "note", e.target.value)}
                        placeholder="Poznamka..."
                        className="w-full max-w-sm bg-black/40 border border-white/[0.07] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 placeholder-neutral-700 transition-colors cursor-auto"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MOBILE CARDS ── */}
      <div className="lg:hidden px-4 py-6 flex flex-col gap-3">
        {days.map((day, i) => {
          const apple = i < 9;
          const cardBorder = apple ? "border-green-900/30" : "border-blue-900/30";
          const cardBg = apple ? "bg-green-950/[0.1]" : "bg-blue-950/[0.1]";
          const accent = apple ? "text-green-400" : "text-blue-400";
          const badgeStyle = apple
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-blue-500/10 text-blue-400 border-blue-500/20";
          const dateLabel = getDateLabel(i);
          const isExpanded = expandedDay === i;
          const hasData = day.weight || day.mood || day.note || day.water > 0;

          return (
            <div key={i} className={`${cardBg} border ${cardBorder} rounded-2xl overflow-hidden`}>
              {/* Card header — always visible, tappable */}
              <button
                onClick={() => setExpandedDay(isExpanded ? null : i)}
                className="w-full flex items-center justify-between p-4 cursor-auto"
              >
                <div className="flex items-center gap-3">
                  <span className={`font-black text-3xl leading-none ${accent}`}>
                    {i + 1}
                  </span>
                  {dateLabel && (
                    <span className="text-neutral-600 text-sm">{dateLabel}</span>
                  )}
                  {hasData && !isExpanded && (
                    <div className="flex items-center gap-2 ml-1">
                      {day.weight && (
                        <span className="text-neutral-400 text-sm font-medium">
                          {day.weight} kg
                        </span>
                      )}
                      {day.mood && <span className="text-sm">{day.mood}</span>}
                      {day.water > 0 && (
                        <span className="text-neutral-600 text-xs">{day.water}x</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${badgeStyle}`}
                  >
                    {apple ? "Jablcna" : "800 kcal"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-neutral-600" />
                  ) : (
                    <ChevronDown size={16} className="text-neutral-600" />
                  )}
                </div>
              </button>

              {/* Expandable content */}
              {isExpanded && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  {/* Weight + Water */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-neutral-600 text-[10px] uppercase tracking-[0.2em] mb-1.5 block">
                        Vaha
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        value={day.weight}
                        onChange={(e) => updateDay(i, "weight", e.target.value)}
                        placeholder="0.0 kg"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-base font-medium focus:outline-none focus:border-white/25 placeholder-neutral-700 cursor-auto"
                      />
                    </div>
                    <div>
                      <label className="text-neutral-600 text-[10px] uppercase tracking-[0.2em] mb-1.5 block">
                        Voda
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => adjustWater(i, -1)}
                          className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-neutral-500 active:bg-white/10 shrink-0 cursor-auto"
                        >
                          <Minus size={14} />
                        </button>
                        <div className="flex-1 text-center">
                          <div className="text-white font-bold text-base leading-tight">
                            {day.water}x
                          </div>
                          <div className="text-neutral-600 text-xs">
                            {(day.water * 0.25).toFixed(2)} l
                          </div>
                        </div>
                        <button
                          onClick={() => adjustWater(i, 1)}
                          className="w-11 h-11 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-neutral-500 active:bg-white/10 shrink-0 cursor-auto"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mood */}
                  <div>
                    <label className="text-neutral-600 text-[10px] uppercase tracking-[0.2em] mb-2 block">
                      Nalada
                    </label>
                    <div className="flex gap-2">
                      {MOODS.map((m) => (
                        <button
                          key={m.emoji}
                          title={m.label}
                          onClick={() =>
                            updateDay(i, "mood", day.mood === m.emoji ? "" : m.emoji)
                          }
                          className={`flex-1 py-2.5 rounded-xl text-xl transition-all cursor-auto ${
                            day.mood === m.emoji
                              ? "bg-white/15 scale-105"
                              : "bg-black/40 border border-white/[0.07] opacity-40 active:opacity-80"
                          }`}
                        >
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="text-neutral-600 text-[10px] uppercase tracking-[0.2em] mb-1.5 block">
                      Poznamka
                    </label>
                    <input
                      type="text"
                      value={day.note}
                      onChange={(e) => updateDay(i, "note", e.target.value)}
                      placeholder="Ako sa citis dnes..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-base focus:outline-none focus:border-white/25 placeholder-neutral-700 cursor-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── EDUCATION PANEL ── */}
      <section className="px-5 md:px-14 py-16 border-t border-white/5">
        {/* Toggle for mobile */}
        <button
          onClick={() => setEduOpen(!eduOpen)}
          className="w-full text-left mb-10 md:mb-12 cursor-auto"
        >
          <p className="text-blue-400 font-mono text-xs tracking-[0.25em] uppercase mb-4">
            // veda za zmenami
          </p>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-[-0.04em] leading-[0.9]">
              Co sa deje
              <br />s tvojim telom
              <span className="text-blue-500">.</span>
            </h2>
            <div className="md:hidden shrink-0 pb-2">
              {eduOpen ? (
                <ChevronUp size={24} className="text-neutral-600" />
              ) : (
                <ChevronDown size={24} className="text-neutral-600" />
              )}
            </div>
          </div>
        </button>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${eduOpen ? "block" : "hidden md:grid"}`}>
          {/* Phase 1 */}
          <div className="bg-white/[0.02] border border-green-900/25 rounded-2xl p-7 md:p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-green-500/[0.04] rounded-full" />
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-green-400 text-xs font-mono tracking-[0.15em]">
                1.–9. den
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-4 tracking-tight">
              1. Faza — Hlbkovy deficit
            </h3>
            <p className="text-neutral-400 leading-relaxed text-[15px]">
              Telo prechadza do stavu hlbokeho deficitu. Ubytok vahy v prvych dnoch je
              tvoreny najma{" "}
              <span className="text-green-400 font-medium">
                glykogenom a viazanou vodou
              </span>
              . Je to startovaci motor pre spalovanie tukov.
            </p>
          </div>

          {/* Phase 2 */}
          <div className="bg-white/[0.02] border border-blue-900/25 rounded-2xl p-7 md:p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/[0.04] rounded-full" />
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-blue-400 text-xs font-mono tracking-[0.15em]">
                10.–17. den
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-4 tracking-tight">
              2. Faza — Ochrana svalov
            </h3>
            <p className="text-neutral-400 leading-relaxed text-[15px]">
              Pridavame bielkoviny (800 kcal), aby sme chranili svalovu hmotu. Pri
              prechode sa vaha moze na{" "}
              <span className="text-blue-400 font-medium">1–2 dni zastavit</span> —
              telo doplna vodu do buniek. Je to biologicky prirodzene a spalovanie tuku
              pod tym stale prebieha.
            </p>
          </div>

          {/* Reality */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 md:p-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/[0.02] rounded-full" />
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              <span className="text-neutral-400 text-xs font-mono tracking-[0.15em]">
                Realita ciela
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold mb-4 tracking-tight">
              Kazdy kg je vitazstvo
            </h3>
            <p className="text-neutral-400 leading-relaxed text-[15px]">
              Pri startovacej vahe 60 kg je ciel 10 kg extremne ambiciozny. Kazdy
              kilogram dole po 5. dni je{" "}
              <span className="text-white font-medium">cisty uspech</span>. Dolezite
              je sledovat{" "}
              <span className="text-white font-medium">naladu a energiu</span> v logu.
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-5 md:px-14 py-10 border-t border-white/5 text-center">
        <p className="text-neutral-700 text-sm">
          Data su ulozene len v tvojom zariadeni (LocalStorage). Nic sa neposiela nikam.
        </p>
      </footer>
    </div>
  );
}
