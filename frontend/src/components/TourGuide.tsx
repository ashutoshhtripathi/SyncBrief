import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, ArrowRight, X, ChevronLeft } from 'lucide-react';

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && step < 3) setStep(s => s + 1);
      if (e.key === 'ArrowLeft' && step > 1) setStep(s => s - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, onClose]);

  if (!isOpen) return null;

  const tourSteps = [
    {
      title: "1. 60-Second Async Check-in",
      tagline: "Replace 30-minute status meetings with high-fidelity async signals.",
      description: "Team members submit what they did yesterday, their focus today, and blockers using voice-to-text or quick bullets. Autosave ensures you never lose draft updates.",
      icon: Sparkles,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/70"
    },
    {
      title: "2. Verifiable Chat Evidence Links",
      tagline: "Zero guessing or chasing 'who said what'.",
      description: "SyncBrief AI extracts blockers and strictly validates them against opted-in channels (#backend, #frontend). Every verified blocker features a green link badge citing the exact source message and author.",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/70"
    },
    {
      title: "3. Executive Digest & Blocker Board",
      tagline: "Actionable engineering velocity without context switching.",
      description: "Managers review synthesized progress, identify cross-timezone risks, and push blockers directly to Azure DevOps Work Items in 1 click. Privacy-first: unopted channels are never scraped.",
      icon: ShieldCheck,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/70"
    }
  ];

  const currentStepData = tourSteps[step - 1];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <span>Step {step} of 3</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${currentStepData.bgColor} shadow-xs`}>
            <Icon className={`w-7 h-7 ${currentStepData.color}`} />
          </div>

          <h3 className="font-extrabold text-xl text-slate-900 dark:text-white tracking-tight">
            {currentStepData.title}
          </h3>

          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {currentStepData.tagline}
          </p>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all duration-200 ${
                  s === step ? 'bg-blue-600 w-7' : 'bg-slate-200 dark:bg-slate-700 w-2'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                <span>Get Started</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
