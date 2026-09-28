import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Sparkles, CheckCircle2, ArrowRight, Loader2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { runDemoScenario } from '../api';

export const DemoScenarioButton: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [resultModal, setResultModal] = useState<any | null>(null);
  const navigate = useNavigate();

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const data = await runDemoScenario();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.8 },
      });
      setResultModal(data);
    } catch (err) {
      console.error('Demo scenario error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white font-medium rounded-full shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white/20"
          title="Run the complete golden-path flow for hackathon judges"
        >
          {isRunning ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="relative">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>
          )}
          <span className="text-sm font-semibold tracking-wide">
            {isRunning ? 'Running Demo...' : 'Run Judge Demo Scenario'}
          </span>
        </button>
      </div>

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Golden Path Demo Complete!</h3>
              </div>
              <button
                onClick={() => setResultModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-white">
                SyncBrief AI successfully executed the full end-to-end hackathon story:
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3.5 space-y-2 border border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 dark:text-blue-400 text-xs mt-0.5">1. Check-in</span>
                  <span>Priya Sharma submitted 60s async update: <i>"PR #184 Auth API is blocked waiting for database migration script from the backend team."</i></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-xs mt-0.5">2. Extraction</span>
                  <span>AI identified <b>High Severity</b> blocker owner Priya Sharma, blocked by Backend Team.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">3. Verifiable Link</span>
                  <span>Strict validator matched chat evidence in <b>#backend</b> thread <code>msg_492</code> by Vikram Joshi.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-purple-600 dark:text-purple-400 text-xs mt-0.5">4. Daily Digest</span>
                  <span>Standup summary synthesized with suggested unblocking actions and Microsoft Teams card payload.</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => {
                  setResultModal(null);
                  navigate(`/channels?channel=backend&highlight=${resultModal.evidence_message_id}`);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow transition"
              >
                <span>Jump to Evidence (#backend)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setResultModal(null);
                  navigate('/digest');
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium text-xs rounded-lg transition"
              >
                <span>View Daily Digest</span>
              </button>
              <button
                onClick={() => {
                  setResultModal(null);
                  navigate('/blockers');
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium text-xs rounded-lg transition"
              >
                <span>Blocker Board</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
