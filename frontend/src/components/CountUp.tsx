import { useEffect, useState } from "react";

export function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(value); return; }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{v.toFixed(decimals)}{suffix}</span>;
}