import { useEffect, useRef, useState } from "react";

export const AUTO_REFRESH_MS = 10_000;

export function useAutoRefresh(refresh: (signal: AbortSignal) => Promise<void>, enabled = true) {
  const latestRefresh = useRef(refresh);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { latestRefresh.current = refresh; }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController | null = null;
    const run = async () => {
      if (controller || document.visibilityState === "hidden") return;
      const request = new AbortController();
      controller = request;
      try {
        await latestRefresh.current(request.signal);
        if (!request.signal.aborted) setError(null);
      } catch (caught) {
        if (!request.signal.aborted) setError(caught);
      } finally {
        if (controller === request) controller = null;
      }
    };
    const timer = window.setInterval(() => { void run(); }, AUTO_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      controller?.abort();
    };
  }, [enabled]);

  return error;
}
