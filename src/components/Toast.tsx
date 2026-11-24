import { TriangleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ICON } from "./icon";

const TOAST_MS = 4000;

const ToastContext = createContext<(text: string) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((text: string) => {
    setToast(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          role="alert"
          className="toast absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex min-h-11 w-max max-w-[min(560px,calc(100vw-2rem))] items-center gap-2 px-4 py-2 text-[13px]"
        >
          <TriangleAlert {...ICON} className="shrink-0" />
          <span className="min-w-0 break-words">{toast}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}
