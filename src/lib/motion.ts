import { useEffect, useRef } from 'react';

/** True when the user asked the OS to reduce motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Signature add-to-bag moment: a small ghost of the artifact flies from the
 * trigger into the Shopping Bag button, then the bag badge bumps. No-ops on
 * reduced-motion or when either anchor is missing.
 */
export function flyToCart(originEl: HTMLElement | null, imageUrl?: string): void {
  if (!originEl || prefersReducedMotion()) return;
  const bag = document.querySelector<HTMLElement>('[aria-label="Shopping Bag"]');
  if (!bag) return;

  const from = originEl.getBoundingClientRect();
  const to = bag.getBoundingClientRect();

  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.cssText = [
    'position:fixed', 'z-index:90', 'pointer-events:none',
    'width:72px', 'height:72px', 'border-radius:0.5rem',
    'overflow:hidden', 'box-shadow:0 12px 32px -8px rgb(0 0 0 / 0.5)',
    'border:1px solid rgb(201 169 97 / 0.5)', 'background:#171a1f',
  ].join(';');
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    ghost.appendChild(img);
  }
  const startX = from.left + from.width / 2 - 36;
  const startY = from.top + from.height / 2 - 36;
  const endX = to.left + to.width / 2 - 36;
  const endY = to.top + to.height / 2 - 36;
  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;
  document.body.appendChild(ghost);

  const arcX = (endX - startX) * 0.5;
  const animation = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
      { transform: `translate(${arcX}px, ${Math.min(endY - startY, 0) * 0.4 - 60}px) scale(0.62)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0.1)`, opacity: 0.25, offset: 1 },
    ],
    { duration: 680, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
  );

  animation.finished
    .then(() => {
      ghost.remove();
      bag.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.28)' },
          { transform: 'scale(1)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );
    })
    .catch(() => ghost.remove());
}

/**
 * Magnetic hover for primary CTAs: the control leans a few pixels toward the
 * cursor and springs back on leave. Pointer-fine devices only.
 */
export function useMagnetic<T extends HTMLElement>(maxShift = 6) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let raf = 0;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transition = 'transform 0.15s ease-out';
        el.style.transform = `translate(${clamp(dx * 0.12, -maxShift, maxShift)}px, ${clamp(dy * 0.18, -maxShift, maxShift)}px)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translate(0, 0)';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => { el.style.transition = ''; }, 520);
    };

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
      clearTimeout(resetTimer);
    };
  }, [maxShift]);

  return ref;
}
