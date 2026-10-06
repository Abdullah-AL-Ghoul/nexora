import React, { useState } from 'react';
import { Product } from '../../types';
import { Globe, Search, Sparkles, X, ExternalLink, Loader2, ArrowRight } from 'lucide-react';

interface MarketIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export const MarketIntelligenceModal: React.FC<MarketIntelligenceModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [query, setQuery] = useState(
    product ? `Recent auction results and market index for ${product.name}` : ''
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    text: string;
    groundingMetadata?: {
      webSearchSources?: { uri: string; title: string }[];
      searchChunks?: { web: { uri: string; title: string } }[];
    };
    timestamp?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (queryText?: string) => {
    const activeQuery = queryText || query;
    if (!activeQuery.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/market-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: activeQuery,
          productContext: product
            ? {
                name: product.name,
                category: product.categoryName,
                price: product.price,
                materials: product.materials,
                origin: product.origin,
              }
            : undefined,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setResult({
          text: data.text,
          groundingMetadata: data.groundingMetadata,
          timestamp: data.timestamp,
        });
      } else {
        setError(data.error || 'Failed to retrieve market intelligence.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network connection failed.');
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    'Recent Swiss mechanical chronograph auction valuations',
    'Planar magnetic vs dynamic driver acoustic benchmarks',
    'Vegetable-tanned French saddle leather longevity standard',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal Stage */}
      <div className="relative w-full max-w-2xl bg-surface border border-line rounded-xl shadow-2xl p-6 sm:p-8 z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-raised border border-line flex items-center justify-center text-gold">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-luxury text-lg font-bold text-fg flex items-center gap-2">
                <span>Atelier Live Market Intelligence</span>
                <span className="text-[10px] font-mono uppercase bg-gold/20 text-gold px-2 py-0.5 rounded">
                  Google Search Grounded
                </span>
              </h3>
              <p className="text-xs text-fg-muted">
                Real-time valuation benchmarks and horological indices powered by Gemini 3.5 & Google Search.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-fg-muted hover:text-fg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-fg-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Inquire live auction results, material spot indices, or horological provenance..."
                className="w-full bg-raised border border-line text-xs text-fg pl-10 pr-3.5 py-3 rounded-lg outline-none focus:border-gold"
              />
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="px-5 py-3 rounded-lg bg-gold text-ink hover:bg-gold-soft font-semibold text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Inquire</span>}
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-fg-muted">Suggested:</span>
            {sampleQueries.map((sample) => (
              <button
                key={sample}
                onClick={() => {
                  setQuery(sample);
                  handleSearch(sample);
                }}
                className="text-[11px] text-gold hover:underline bg-raised px-2 py-1 rounded border border-line transition-colors cursor-pointer"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/40 text-xs text-danger">
            {error}
          </div>
        )}

        {/* Result Area */}
        {result && (
          <div className="p-5 rounded-lg bg-raised border border-line space-y-4 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] font-mono text-gold border-b border-line pb-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Grounded Dispatch</span>
              </span>
              <span>{result.timestamp ? new Date(result.timestamp).toLocaleTimeString() : ''}</span>
            </div>

            <div className="text-xs text-fg leading-relaxed whitespace-pre-wrap font-sans">
              {result.text}
            </div>

            {/* Citations if available */}
            {result.groundingMetadata && (
              <div className="pt-3 border-t border-line text-[11px] space-y-1">
                <span className="text-fg-muted uppercase font-mono tracking-wider block">
                  Grounding Sources & Verifications:
                </span>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(
                    result.groundingMetadata.webSearchSources ||
                    result.groundingMetadata.searchChunks ||
                    []
                  ).map((source: any, idx: number) => {
                    const uri = source.uri || source.web?.uri;
                    const title = source.title || source.web?.title || uri;
                    if (!uri) return null;
                    return (
                      <a
                        key={idx}
                        href={uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gold hover:underline text-[10px] bg-surface border border-line px-2 py-0.5 rounded"
                      >
                        <span className="truncate max-w-[200px]">{title}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
