import { useEffect, useState } from "react";

const CSS_PX_PER_INCH = 96;

/**
 * At 100% the page shrinks to fit a narrow window (phones, split screens) so
 * the whole line is always visible. Any other zoom level is honoured exactly.
 */
export function useFitZoom(stageRef, pageWidthInches, zoom) {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => {
      const style = getComputedStyle(stage);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      setAvailable(stage.clientWidth - padding);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef]);

  if (zoom !== 1 || !available) return zoom;
  const fit = available / (pageWidthInches * CSS_PX_PER_INCH);
  return fit < 1 ? Math.max(0.4, Math.floor(fit * 100) / 100) : 1;
}
