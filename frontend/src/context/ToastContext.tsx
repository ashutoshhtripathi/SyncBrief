import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: ToastItem = { id, type, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast Notification Container */}
      <div 
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
        role="region"
      >
        {toasts.map((toast) => {
          let bgClass = 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 shadow-xl';
          let Icon = Info;
          let iconColor = 'text-blue-500';

          if (toast.type === 'success') {
            bgClass = 'bg-emerald-50 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100 border-emerald-300 dark:border-emerald-800 shadow-emerald-500/10 shadow-xl';
            Icon = CheckCircle2;
            iconColor = 'text-emerald-500';
          } else if (toast.type === 'error') {
            bgClass = 'bg-rose-50 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100 border-rose-300 dark:border-rose-800 shadow-rose-500/10 shadow-xl';
            Icon = AlertCircle;
            iconColor = 'text-rose-500';
          } else if (toast.type === 'warning') {
            bgClass = 'bg-amber-50 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800 shadow-amber-500/10 shadow-xl';
            Icon = AlertTriangle;
            iconColor = 'text-amber-500';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs font-medium animate-in slide-in-from-bottom-3 duration-200 backdrop-blur-md ${bgClass}`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition text-slate-400 hover:text-slate-600"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return {
    show: context.showToast,
    success: (msg: string, duration?: number) => context.showToast(msg, 'success', duration),
    error: (msg: string, duration?: number) => context.showToast(msg, 'error', duration),
    info: (msg: string, duration?: number) => context.showToast(msg, 'info', duration),
    warning: (msg: string, duration?: number) => context.showToast(msg, 'warning', duration),
    dismiss: context.removeToast,
  };
};
