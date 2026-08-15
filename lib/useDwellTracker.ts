'use client';
// Build 6.2 — client dwell tracker. Measures how long a document stays open in the
// in-app viewer and beacons it to /api/track-dwell on close / tab-hide / unload.
// Requires opening docs in an in-app viewer (iframe/modal) rather than window.open,
// so the timer can see the whole view. Usage:
//   const { start, stop } = useDwellTracker();
//   start(filePath)  // when a document opens inline
//   stop()           // when the viewer closes
import { useRef, useCallback, useEffect } from 'react';

export function useDwellTracker() {
  const ref = useRef<{ file: string; t0: number } | null>(null);

  const send = useCallback((file: string, duration_ms: number, reason: string) => {
    if (duration_ms < 1000) return; // ignore accidental opens / sub-second segments
    const payload = JSON.stringify({ file_path: file, duration_ms, reason });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/track-dwell', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track-dwell', { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  }, []);

  // flush the current segment and close the session (doc no longer open)
  const flush = useCallback((reason: string) => {
    const s = ref.current;
    if (!s) return;
    send(s.file, Date.now() - s.t0, reason);
    ref.current = null;
  }, [send]);

  const start = useCallback((file: string) => { flush('switch'); ref.current = { file, t0: Date.now() }; }, [flush]);
  const stop = useCallback(() => flush('close'), [flush]);

  useEffect(() => {
    // Tab-switch does NOT end the session: flush the visible segment, then keep the doc
    // open and restart the clock on return — so time is only counted while actually visible.
    const onVis = () => {
      const s = ref.current;
      if (!s) return;
      if (document.visibilityState === 'hidden') send(s.file, Date.now() - s.t0, 'hidden');
      s.t0 = Date.now();
    };
    const onHide = () => flush('unload');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      flush('close');
    };
  }, [flush, send]);

  return { start, stop };
}
