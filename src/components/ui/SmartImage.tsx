import React, { useState } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

interface SmartImageProps {
  /** Bundled JPEG path (e.g. /img/nx-....jpg). A .webp sibling is served when present. */
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  /** Pointer-tracked zoom on hover (transform-origin follows the cursor). */
  zoom?: boolean;
  /** Shared-element name for View Transitions (e.g. `product-<id>`). */
  viewTransitionName?: string;
  eager?: boolean;
}

/**
 * Brand image primitive: WebP-with-JPEG-fallback via <picture>, fade-in on
 * decode, and an optional cursor-tracked zoom — the quiet luxury hover.
 */
export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  zoom = false,
  viewTransitionName,
  eager = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const isJpeg = /\.jpe?g$/i.test(src);
  const webpSrc = src.replace(/\.jpe?g$/i, '.webp');

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoom || prefersReducedMotion()) return;
    const img = e.currentTarget.querySelector('img');
    if (!img) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    img.style.transformOrigin = `${x}% ${y}%`;
  };

  return (
    <div
      className={`relative overflow-hidden ${zoom ? 'smart-zoom-wrap' : ''} ${wrapperClassName}`}
      onMouseMove={handleMove}
    >
      <picture>
        {isJpeg && <source srcSet={webpSrc} type="image/webp" />}
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={viewTransitionName ? { viewTransitionName } : undefined}
          className={`${className} smart-fade ${loaded ? 'opacity-100' : 'opacity-0'} ${zoom ? 'smart-zoom' : ''}`}
        />
      </picture>
    </div>
  );
};

export default SmartImage;
