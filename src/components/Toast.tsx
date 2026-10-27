import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

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
          className="absolute z-20 bottom-4 left-1/2 -translate-x-1/2 rounded-md border border-error-border bg-error-bg text-error-foreground text-sm px-4 py-2 shadow-xl"
        >
          {toast}
        </div>
      )}
    </ToastContext.Provider>
  );
}
