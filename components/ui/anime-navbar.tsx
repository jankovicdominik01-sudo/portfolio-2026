"use client"
import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem { name: string; url: string; icon: LucideIcon }
interface NavBarProps { items: NavItem[]; className?: string; defaultActive?: string }

export function AnimeNavBar({ items, className, defaultActive = "Domov" }: NavBarProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(defaultActive);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="fixed top-5 left-0 right-0 z-[9999]">
      <div className="flex justify-center pt-6">
        <motion.div className="flex items-center gap-3 bg-black/60 border border-white/10 backdrop-blur-lg py-2 px-2 rounded-full shadow-lg relative" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
          {items.map((item) => {
            const Icon = item.icon; const isActive = activeTab === item.name; const isHovered = hoveredTab === item.name;
            return (
              <Link key={item.name} href={item.url} onClick={() => setActiveTab(item.name)} onMouseEnter={() => setHoveredTab(item.name)} onMouseLeave={() => setHoveredTab(null)} className={cn("relative cursor-pointer text-sm font-semibold px-6 py-3 rounded-full transition-all duration-300", "text-white/70 hover:text-white", isActive && "text-white")}>
                {isActive && (
                  <motion.div className="absolute inset-0 rounded-full -z-10 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.03, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                    <div className="absolute inset-0 bg-blue-500/30 rounded-full blur-md" />
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0" style={{ animation: "shine 3s ease-in-out infinite" }} />
                  </motion.div>
                )}
                <motion.span className="hidden md:inline relative z-10">{item.name}</motion.span>
                <motion.span className="md:hidden relative z-10"><Icon size={18} strokeWidth={2.5} /></motion.span>
                <AnimatePresence>
                  {isHovered && !isActive && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute inset-0 bg-white/10 rounded-full -z-10" />}
                </AnimatePresence>
              </Link>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}