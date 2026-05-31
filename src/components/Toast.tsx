import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface ToastProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(message.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [message.id, onClose]);

  const typeStyles = {
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-800/40",
      text: "text-emerald-800 dark:text-emerald-300",
      icon: <CheckCircle2 size={16} className="text-emerald-500" />
    },
    error: {
      bg: "bg-rose-50 dark:bg-rose-950/20",
      border: "border-rose-200 dark:border-rose-800/40",
      text: "text-rose-800 dark:text-rose-300",
      icon: <AlertCircle size={16} className="text-rose-500" />
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/20",
      border: "border-blue-200 dark:border-blue-800/40",
      text: "text-blue-800 dark:text-blue-300",
      icon: <Info size={16} className="text-blue-500" />
    }
  };

  const style = typeStyles[message.type];

  return (
    <div 
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${style.bg} ${style.border} ${style.text} shadow-xl shadow-black/5 max-w-sm w-full transition-transform duration-300`}
    >
      <div className="shrink-0">{style.icon}</div>
      <div className="text-xs font-semibold leading-relaxed tracking-wide select-none">{message.text}</div>
      <button 
        onClick={() => onClose(message.id)}
        className="ml-auto shrink-0 p-0.5 rounded-md hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors duration-150"
      >
        <X size={13} />
      </button>
    </div>
  );
};
export default Toast;
