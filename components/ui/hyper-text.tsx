"use client";

import { AnimatePresence, motion, Variants } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface HyperTextProps {
  text: string;
  duration?: number;
  framerProps?: Variants;
  className?: string;
  animateOnLoad?: boolean;
}

const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const getRandomInt = (max: number) => Math.floor(Math.random() * max);

export function HyperText({ 
  text, 
  duration = 800, 
  framerProps = { initial: { opacity: 0, y: -10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 3 } }, 
  className, 
  animateOnLoad = true 
}: HyperTextProps) {
  const [displayText, setDisplayText] = useState(text.split(""));
  const [trigger, setTrigger] = useState(false);
  const interations = useRef(0);
  const isFirstRender = useRef(true);

  const triggerAnimation = () => { interations.current = 0; setTrigger(true); };

  useEffect(() => {
    const interval = setInterval(() => {
        if (!animateOnLoad && isFirstRender.current) { clearInterval(interval); isFirstRender.current = false; return; }
        if (interations.current < text.length) {
          setDisplayText((t) => t.map((l, i) => l === " " ? l : i <= interations.current ? text[i] : alphabets[getRandomInt(26)]));
          interations.current = interations.current + 0.1;
        } else { setTrigger(false); clearInterval(interval); }
      }, duration / (text.length * 10));
    return () => clearInterval(interval);
  }, [text, duration, trigger, animateOnLoad]);

  // Rozdelíme text na slová, aby sme predišli zalamovaniu v polovici slova na mobiloch
  const words = text.split(" ");

  return (
    <div 
      // Pridané medzery medzi slovami (gap-x) a riadkami na mobile (gap-y)
      className="flex justify-center flex-wrap w-full cursor-default py-2 gap-x-[0.3em] gap-y-2 md:gap-y-0" 
      onMouseEnter={triggerAnimation}
    >
      <AnimatePresence>
        {words.map((word, wordIndex) => {
          // Vypočítame globálny index začiatku slova pre správne mapovanie animácie
          const startIndex = words.slice(0, wordIndex).join(" ").length + (wordIndex > 0 ? 1 : 0);

          return (
            // Toto zaručí, že slovo sa NIKDY nezalomí v polovici (napr. JANKOV-IČ)
            <span key={wordIndex} className="inline-flex whitespace-nowrap px-1">
              {word.split("").map((_, letterIndex) => {
                const globalIndex = startIndex + letterIndex;
                const letter = displayText[globalIndex];
                const isSettled = letter === text[globalIndex];

                return (
                  <motion.span 
                    key={globalIndex} 
                    className={cn(
                      "font-mono transition-all duration-700",
                      // Opravený gradient: horizontálny (to-r) a žiarivejšie farby
                      isSettled 
                        ? "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" 
                        : "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]",
                      className
                    )} 
                    {...framerProps}
                  >
                    {letter.toUpperCase()}
                  </motion.span>
                );
              })}
            </span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}