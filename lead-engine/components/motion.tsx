"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Jemný nástup obsahu — používa sa pri načítaní obrazovky, nie neustále. */
export function FadeIn({
  children,
  delay = 0,
  y = 10,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Zoznam, kde sa položky elegantne objavia jedna po druhej. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.ul
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.045 } } }}
    >
      {children}
    </motion.ul>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.li
      layout
      className={className}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.li>
  );
}

/** Krátka mikrointerakcia po úspechu (odovzdanie leadu). */
export function SuccessMark({ tone = "ok" }: { tone?: "ok" | "neutral" }) {
  const color = tone === "ok" ? "#22c55e" : "rgba(255,255,255,0.7)";
  return (
    <motion.div
      className="relative grid size-24 place-items-center"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: tone === "ok" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)" }}
        initial={{ scale: 0.4 }}
        animate={{ scale: [0.4, 1.25, 1] }}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <svg viewBox="0 0 52 52" className="relative size-14" aria-hidden>
        <motion.circle
          cx="26"
          cy="26"
          r="24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        />
        <motion.path
          d="M15 27 l7 7 l15 -16"
          fill="none"
          stroke={color}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, delay: 0.45, ease: EASE }}
        />
      </svg>
    </motion.div>
  );
}
