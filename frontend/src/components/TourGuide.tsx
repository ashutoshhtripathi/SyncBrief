import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, ArrowRight, X } from 'lucide-react';

interface TourGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TourGuide: React.FC<TourGuideProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  const tourSteps = [
    {
      title: "1. 60-Second Async Check-in",
      tagline: "Replace 30-minute status meetings with high-fidelity async signals.",
      description: "Team members submit what they did yesterday, their focus today, and blockers using voice-to-text or quick bullets. Autosave ensures you never lose draft updates.",
      icon: Sparkles,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950/50"
    },
    {
      title: "2. Verifiable Chat Evidence Links",
      tagline: "No more 'who said what' or guessing blocker validity.",
      description: "SyncBrief AI extracts blockers and strictly validates them against opted-in channels (#backend, #frontend). Every verified blocker features a green link badge citing the exact source message and author.",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/50"
    },
    {
      title: "3. Executive Digest & Blocker Board",
      tagline: "Actionable engineering velocity without context switching.",
      description: "Managers review synthesized progress, identify cross-timezone risks, and push blockers directly to Azure DevOps Work Items in 1 click. Privacy-first: unopted channels are never scraped.",
      icon: ShieldCheck,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950/50"
    }
  ];

  const currentStepData = tourSteps[step - 1];
  const Icon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <span>Step {step} of 3</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentStepData.bgColor}`}>
            <Icon className={`w-6 h-6 ${currentStepData.color}`} />
          </div>

          <h3 className="font-bold text-xl text-slate-900 dark:text-white">
            {currentStepData.title}
          </h3>

          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {currentStepData.tagline}
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  s === step ? 'bg-blue-600 w-6' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow transition"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow transition"
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
