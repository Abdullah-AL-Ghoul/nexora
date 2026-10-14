"use client";

import { motion } from "framer-motion";

export function AuthAnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Primary Floating Gold Glow Orb */}
      <motion.div
        className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/15 blur-3xl"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -30, 20, 0],
          scale: [1, 1.15, 0.95, 1],
          opacity: [0.15, 0.25, 0.18, 0.15],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary Warm Amber Orb */}
      <motion.div
        className="absolute -bottom-32 -right-32 size-[28rem] rounded-full bg-amber-500/10 blur-[100px]"
        animate={{
          x: [0, -50, 25, 0],
          y: [0, 40, -30, 0],
          scale: [1, 1.2, 0.9, 1],
          opacity: [0.1, 0.22, 0.12, 0.1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Center Subtle Breathing Radial Spotlight */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[36rem] rounded-full bg-primary/[0.04] blur-2xl"
        animate={{
          scale: [0.9, 1.1, 0.9],
          opacity: [0.03, 0.08, 0.03],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Luxury Horology Celestial Dial Silhouette (Rotating Gear) */}
      <motion.div
        className="absolute -bottom-20 -left-20 size-80 rounded-full border border-dashed border-primary/15 opacity-30 dark:opacity-20 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{
          duration: 90,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="absolute inset-4 rounded-full border border-primary/5" />
        <div className="absolute inset-12 rounded-full border border-primary/10" style={{ borderStyle: "dotted" }} />
      </motion.div>

      {/* Subtle Star Glitter Particles */}
      {[
        { top: "15%", left: "10%", delay: 0 },
        { top: "25%", right: "12%", delay: 1.5 },
        { bottom: "20%", left: "18%", delay: 3 },
        { bottom: "35%", right: "8%", delay: 4.2 },
      ].map((star, i) => (
        <motion.div
          key={i}
          className="absolute size-1 rounded-full bg-primary"
          style={{ top: star.top, left: star.left, right: star.right }}
          animate={{
            scale: [0, 1.4, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: star.delay,
          }}
        />
      ))}
    </div>
  );
}
