"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const currentPath = `${pathname}?${searchParams.toString()}`;
  const prevPathRef = useRef(currentPath);

  // When route changes, complete the bar asynchronously and fade out
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath;
      if (visible) {
        const completeTimer = setTimeout(() => {
          setProgress(100);
        }, 0);
        const fadeTimer = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
        return () => {
          clearTimeout(completeTimer);
          clearTimeout(fadeTimer);
        };
      }
    }
  }, [currentPath, visible]);

  // Listen to clicks on internal navigation links
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Check if it's an internal link
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
            setVisible(true);
            setProgress(35);
            // Simulate progression
            setTimeout(() => setProgress((p) => (p === 35 ? 75 : p)), 150);
          }
        }
      } catch {
        // Ignore invalid URLs
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2.5px] overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-primary/70 via-secondary to-primary shadow-[0_0_12px_rgba(201,169,97,0.8)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
