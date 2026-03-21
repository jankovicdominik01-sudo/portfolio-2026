"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface LinkItem {
  href: string;
  label: string;
}

interface FooterProps {
  leftLinks: LinkItem[];
  rightLinks: LinkItem[];
  copyrightText: string;
  barCount?: number;
  contactInfo?: {
    email: string;
    phone: string;
  };
}

const Footer: React.FC<FooterProps> = ({ 
  leftLinks, 
  rightLinks, 
  copyrightText, 
  barCount = 60,
  contactInfo 
}) => {
  const waveRefs = useRef<(HTMLDivElement | null)[]>([]);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    if (footerRef.current) observer.observe(footerRef.current);
    return () => { if (footerRef.current) observer.unobserve(footerRef.current); };
  }, []);

  useEffect(() => {
    let t = 0;
    const animateWave = () => {
      waveRefs.current.forEach((element, index) => {
        if (element) {
          const wave1 = Math.sin(t * 1.5 + index * 0.15) * 15;
          const wave2 = Math.cos(t * 0.8 + index * 0.08) * 10;
          const totalWave = wave1 + wave2;

          element.style.transform = `translateY(${totalWave}px)`;
          element.style.opacity = `${0.4 + ((totalWave + 25) / 50) * 0.6}`;
        }
      });
      t += 0.04; 
      animationFrameRef.current = requestAnimationFrame(animateWave);
    };

    if (isVisible) animateWave();
    else if (animationFrameRef.current) { 
      cancelAnimationFrame(animationFrameRef.current); 
      animationFrameRef.current = null; 
    }

    return () => { 
      if (animationFrameRef.current) { 
        cancelAnimationFrame(animationFrameRef.current); 
      } 
    };
  }, [isVisible]);

  return (
    <footer ref={footerRef} className="relative bg-[#030303] text-white w-full flex flex-col justify-between pt-24 overflow-hidden mt-32">
      
      {/* Dekoratívna vrchná žiara */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4/5 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60 shadow-[0_0_20px_rgba(59,130,246,0.9)]"></div>

      {/* Hlavný obsah - 3 stĺpcový layout pre väčšiu čistotu */}
      <div className="container mx-auto px-6 md:px-12 z-20 relative pb-56"> 
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 justify-between w-full">
          
          {/* Stĺpec 1 - Značka (Logo + Text vedľa seba) */}
          <div className="space-y-6 max-w-sm">
            
            <div 
              className="flex items-center gap-4 cursor-pointer group w-fit" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              {/* Vlastné Logo */}
              <div className="relative w-12 h-12 shrink-0 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
                <Image 
                  src="/LOGOFINAL.svg" 
                  alt="Dominik Jankovič Logo" 
                  fill
                  className="object-contain relative z-10"
                />
              </div>
              
              {/* Tvoj pôvodný krásny nadpis */}
              <h3 className="text-4xl font-black tracking-tighter">
                Dominik <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">Jankovič</span>
              </h3>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed">
              Prémiový vývoj. Kód, na ktorý sa dá spoľahnúť. Dizajn, ktorý inšpiruje a generuje výsledky.
            </p>
          </div>

          {/* Stĺpec 2 - Kontakt a Informácie */}
          <div className="space-y-8 md:pt-4">
            {contactInfo && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Kontakt</h4>
                <div className="flex flex-col space-y-2">
                  <a href={`mailto:${contactInfo.email}`} className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 text-sm font-mono">
                    {contactInfo.email}
                  </a>
                  <a href={`tel:${contactInfo.phone.replace(/\s+/g, '')}`} className="text-gray-300 hover:text-cyan-400 transition-colors duration-300 text-sm font-mono">
                    {contactInfo.phone}
                  </a>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Informácie</h4>
              <ul className="flex flex-col gap-3">
                {leftLinks.map((link, i) => (
                  <li key={i}>
                    <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-all duration-300 flex items-center gap-2 group">
                      <span className="w-1 h-1 rounded-full bg-transparent group-hover:bg-blue-500 transition-all duration-300"></span>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Stĺpec 3 - Odkazy a Copyright */}
          <div className="flex flex-col md:items-end justify-between space-y-8 md:pt-4">
            <div className="space-y-4 md:text-right w-full">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Siete</h4>
              <ul className="flex flex-col md:items-end gap-3">
                {rightLinks.map((link, i) => (
                  <li key={i}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-300 hover:text-white transition-colors duration-300 relative group inline-block">
                      {link.label}
                      <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-gradient-to-r from-blue-500 to-cyan-400 group-hover:w-full transition-all duration-300 ease-out"></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            
            <p className="text-xs text-gray-600 font-mono text-left md:text-right border-t border-white/10 md:border-none pt-6 md:pt-0 w-full">
              {copyrightText}
            </p>
          </div>
        </div>
      </div>

      {/* Animované vlny (Bary) */}
      <div id="waveContainer" className="absolute bottom-0 translate-y-20 w-full flex justify-evenly items-end px-2 h-[250px] z-0 pointer-events-none opacity-80">
        {Array.from({ length: barCount }).map((_, index) => {
          const normalized = index / (barCount - 1);
          const distance = Math.abs(normalized - 0.5) * 2; 
          const baseHeight = 30 + (1 - distance) * 140; 

          return (
            <div 
              key={index} 
              ref={(el) => { waveRefs.current[index] = el; }} 
              className="w-1.5 sm:w-2 md:w-[10px] rounded-t-full bg-gradient-to-t from-blue-900 via-blue-600 to-cyan-400 mix-blend-screen shadow-[0_0_15px_rgba(59,130,246,0.2)]" 
              style={{ height: `${baseHeight}px` }} 
            />
          );
        })}
      </div>
      
      {/* Tmavý gradient na spodu */}
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#010101] via-[#010101]/90 to-transparent z-10 pointer-events-none"></div>
    </footer>
  );
};

export default Footer;