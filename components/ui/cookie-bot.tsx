"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";

export function CookieBot() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Skontrolujeme, či už používateľ súhlasil
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Ak nie, po 1 sekunde zobrazíme banner
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem("cookieConsent", "all");
    setIsVisible(false);
  };

  const acceptNecessary = () => {
    localStorage.setItem("cookieConsent", "necessary");
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[450px] bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl z-[99999]"
        >
          <button onClick={acceptNecessary} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
          
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-blue-500/20 rounded-full text-blue-500">
              <Cookie size={24} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-1">Ochrana súkromia</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Tento web používa cookies na zabezpečenie základných funkcií a analýzu návštevnosti. Vaše dáta sú u mňa v bezpečí.
                <a href="#" className="text-blue-400 hover:underline ml-1">Čítať podmienky</a>.
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={acceptAll} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">
              Prijať všetky
            </button>
            <button onClick={acceptNecessary} className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 text-white font-bold rounded-xl transition-colors">
              Iba nevyhnutné
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}