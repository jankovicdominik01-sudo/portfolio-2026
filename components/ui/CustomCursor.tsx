"use client";
import { useEffect, useState, useRef } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hoverType, setHoverType] = useState<string | null>(null);

  // useMotionValue pre GPU akceleráciu polohy
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // useSpring robí ten "gumový", plynulý a fancy pohyb, ktorý vyzerá neskutočne dobre
  // stiffness a damping sú nastavené na plynulý, ale presný "heavy" pocit
  const springConfig = { stiffness: 400, damping: 30, mass: 0.8 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Ukážeme kurzor až keď sa pohne myš, aby neblikal pri načítaní
    const moveCursor = (e: MouseEvent) => {
      if (!isVisible) setIsVisible(true);
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Detekcia interactive elementov (tlačidlá, linky, inputy)
      const interactiveElements = ['button', 'a', 'input', 'textarea'];
      const isInteractive = interactiveElements.includes(target.tagName.toLowerCase()) || target.closest('button') || target.closest('a');
      
      if (isInteractive) {
        setIsHovering(true);
        setHoverType('interactive');
        return;
      }

      // Detekcia projektov (zväčšíme kurzor ešte viac a zmeníme farbu)
      if (target.closest('[id="work"] a') || target.closest('img')) {
        setIsHovering(true);
        setHoverType('project');
        return;
      }

      setIsHovering(false);
      setHoverType(null);
    };

    const handleMouseLeaveWindow = () => {
      setIsVisible(false);
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", handleMouseLeaveWindow);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeaveWindow);
    };
  }, [mouseX, mouseY, isVisible]);

  return (
    <>
      {/* HLAVNÝ fancy KURZOR: 
        Mix-blend-difference robí ten "invert" efekt farieb, keď kurzor prejde cez svetlé pozadie.
      */}
      <motion.div
        className="fixed top-0 left-0 rounded-full border border-blue-400 pointer-events-none z-[9999999] mix-blend-difference hidden md:block"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: "-50%", // Vycentrovanie
          translateY: "-50%",
        }}
        animate={{
          // Dynamická zmena veľkosti a vzhľadu
          width: hoverType === 'project' ? 100 : (isHovering ? 60 : 24),
          height: hoverType === 'project' ? 100 : (isHovering ? 60 : 24),
          backgroundColor: hoverType === 'project' ? "rgba(59, 130, 246, 0.3)" : (isHovering ? "rgba(59, 130, 246, 0.15)" : "rgba(0, 0, 0, 0)"), 
          borderColor: isHovering ? "rgba(96, 165, 250, 1)" : "rgba(59, 130, 246, 0.5)",
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }} // <--- GUMOVÝ EFEKT NA VEĽKOSŤ
      />

      {/* PRESNÁ BODKA V STREDE: 
        Ukazuje presný bod kliknutia.
      */}
       <motion.div
        className="fixed top-0 left-0 w-1 h-1 bg-blue-400 rounded-full pointer-events-none z-[9999999] hidden md:block"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isHovering ? 0 : 1, // Bodka zmizne pri hoveri
        }}
      />
    </>
  );
}