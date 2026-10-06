/* Lightweight per-page SEO manager (SPA-friendly).
 * Sets document.title, meta description, canonical and optional JSON-LD.
 * JSON-LD scripts are keyed so re-navigation replaces rather than stacks them. */

const jsonLdScripts = new Map<string, HTMLScriptElement>();

export interface MetaInput {
  title?: string;
  description?: string;
  canonical?: string;
  jsonLd?: { key: string; data: Record<string, unknown> }[];
}

function setMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function setMeta({ title, description, canonical, jsonLd }: MetaInput): void {
  if (title) document.title = title;
  if (title) setMetaTag('property', 'og:title', title);
  if (description) {
    setMetaTag('name', 'description', description);
    setMetaTag('property', 'og:description', description);
  }
  if (canonical) {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
    setMetaTag('property', 'og:url', canonical);
  }
  if (jsonLd) {
    const seen = new Set<string>();
    for (const { key, data } of jsonLd) {
      seen.add(key);
      let script = jsonLdScripts.get(key);
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-meta-key', key);
        document.head.appendChild(script);
        jsonLdScripts.set(key, script);
      }
      script.textContent = JSON.stringify(data);
    }
    // Remove stale JSON-LD blocks no longer emitted
    for (const [key, script] of jsonLdScripts) {
      if (!seen.has(key)) script.remove();
    }
  }
}
