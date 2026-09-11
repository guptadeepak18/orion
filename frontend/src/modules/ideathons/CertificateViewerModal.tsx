import React, { useRef } from 'react';
import { Award, Printer, X, ShieldCheck, Sparkles } from 'lucide-react';

export interface CertificateData {
  id: string;
  ideathon_title: string;
  recipient_name: string;
  team_name: string;
  project_title: string;
  certificate_type: string; // winner_1st, winner_2nd, winner_3rd, category_award, participation
  title: string;
  certificate_number: string;
  verification_hash: string;
  issued_at: string;
}

interface CertificateViewerModalProps {
  certificate: CertificateData | null;
  onClose: () => void;
}

export const CertificateViewerModal: React.FC<CertificateViewerModalProps> = ({ certificate, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPodium = ['winner_1st', 'winner_2nd', 'winner_3rd'].includes(certificate.certificate_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Verified Digital Credential</h3>
              <p className="text-xs text-slate-400">HyperBuild Innovation & Ideathon Lab</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body (Printable Container) */}
        <div className="p-6 md:p-10 flex justify-center bg-slate-950">
          <div
            ref={printRef}
            className="relative w-full max-w-3xl aspect-[1.414/1] bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-8 border-double border-amber-500/30 rounded-2xl p-8 md:p-12 flex flex-col justify-between text-center shadow-2xl overflow-hidden"
            style={{ minHeight: '520px' }}
          >
            {/* Background watermark & decorative aura */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Corner Decorative Badges */}
            <div className="absolute top-4 left-4 text-xs font-mono text-amber-500/40 tracking-widest uppercase">
              ORION • HYPERBUILD
            </div>
            <div className="absolute top-4 right-4 text-xs font-mono text-slate-500">
              ID: {certificate.certificate_number}
            </div>

            {/* Header Content */}
            <div className="relative z-10 pt-4">
              <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/30 mb-3 shadow-lg">
                <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase font-serif">
                Certificate of {isPodium ? 'Excellence' : 'Participation'}
              </h1>
              <p className="text-xs md:text-sm text-amber-400 font-medium tracking-wide uppercase mt-1">
                {certificate.ideathon_title}
              </p>
            </div>

            {/* Center Recipient Presentation */}
            <div className="relative z-10 my-auto py-4">
              <p className="text-xs md:text-sm text-slate-400 italic">This is proudly presented to</p>
              <h2 className="text-2xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-amber-300 tracking-wide mt-2">
                {certificate.recipient_name}
              </h2>
              <p className="text-xs md:text-sm text-slate-300 max-w-xl mx-auto mt-3 leading-relaxed">
                representing team <span className="font-semibold text-amber-300">"{certificate.team_name}"</span> for exceptional market research, gap identification, and architectural formulation for the venture{' '}
                <span className="font-semibold text-white">"{certificate.project_title}"</span>.
              </p>

              {isPodium && (
                <div className="inline-block mt-4 px-4 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 text-xs md:text-sm font-semibold shadow-inner">
                  ⭐ {certificate.title} ⭐
                </div>
              )}
            </div>

            {/* Footer & Digital Hash */}
            <div className="relative z-10 pt-6 border-t border-slate-800/80 grid grid-cols-3 items-end text-left text-xs">
              <div>
                <p className="text-slate-500 uppercase text-[10px] tracking-wider">Date of Issue</p>
                <p className="text-slate-200 font-medium mt-0.5">
                  {new Date(certificate.issued_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Credential
                </div>
              </div>

              <div className="text-right">
                <p className="text-slate-500 uppercase text-[10px] tracking-wider">Convener / Dean</p>
                <p className="text-slate-200 font-semibold mt-0.5">HyperBuild Innovation Board</p>
              </div>
            </div>

            {/* Cryptographic hash label */}
            <div className="mt-3 text-[9px] font-mono text-slate-600 truncate text-center">
              SHA256: {certificate.verification_hash}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
