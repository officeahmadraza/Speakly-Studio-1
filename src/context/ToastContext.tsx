import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration: number = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, message, duration };

      setToasts(prev => [...prev.slice(-4), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast viewport container (above mobile navigation) */}
      <div
        className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-[calc(100%-1.5rem)] sm:w-auto pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(toast => {
          let Icon = Info;
          let borderColor = 'border-[#E5E7E8] dark:border-[#292E36]';
          let iconColor = 'text-[#315BCB] dark:text-blue-400';

          if (toast.type === 'success') {
            Icon = CheckCircle2;
            borderColor = 'border-[#23865A]/30';
            iconColor = 'text-[#23865A]';
          } else if (toast.type === 'error') {
            Icon = AlertCircle;
            borderColor = 'border-[#C04444]/30';
            iconColor = 'text-[#C04444]';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            borderColor = 'border-[#B7791F]/30';
            iconColor = 'text-[#B7791F] dark:text-amber-400';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white/95 dark:bg-[#181B20]/95 backdrop-blur-md border ${borderColor} text-[#20242B] dark:text-[#F0F2F5] shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
            >
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                {toast.title && <div className="text-xs font-bold text-[#20242B] dark:text-[#F0F2F5]">{toast.title}</div>}
                <div className="text-xs text-[#69717C] dark:text-[#9CA3AF] leading-relaxed">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[#8E97A4] hover:text-[#20242B] dark:hover:text-white p-1 rounded-md hover:bg-[#F0F2F5] dark:hover:bg-[#20252C] transition-colors shrink-0"
                aria-label="Dismiss notification"
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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
