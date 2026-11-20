import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { RoundMark } from "./statusTone";

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
          className="absolute z-20 bottom-6 left-1/2 -translate-x-1/2 flex h-11 items-center gap-2 rounded-full bg-foreground pl-2 pr-4 text-[13px] text-background shadow-oneui"
        >
          <RoundMark mark={{ kind: "state", state: "Error" }} />
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}
