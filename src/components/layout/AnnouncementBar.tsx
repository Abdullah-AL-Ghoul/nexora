import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

export const AnnouncementBar: React.FC = () => {
  return (
    <div className="bg-[#121418] border-b border-[#242831] text-xs text-[#9CA3AF] py-2 px-4 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#C9A961]" />
          <span>AUTHENTICITY GUARANTEED · SWISS HOROLOGY & PRECISION CRAFT</span>
        </div>
        <div className="mx-auto sm:mx-0 flex items-center gap-2 text-center">
          <Sparkles className="w-3.5 h-3.5 text-[#C9A961]" />
          <span>
            COMPLIMENTARY INSURED WHITE-GLOVE FREIGHT ON ORDERS &gt; $200 · CODE:{' '}
            <strong className="text-[#C9A961] font-semibold tracking-wider">NEXORA10</strong>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[11px] text-[#9CA3AF]">
          <span className="text-[#C9A961] font-medium">24/7 PRIVATE CONCIERGE</span>
        </div>
      </div>
    </div>
  );
};
