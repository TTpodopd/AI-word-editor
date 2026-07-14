import { useEffect } from "react";

const BASE_WIDTH = 360;

export function useViewportScale() {
  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const scale = Math.min(Math.max(width / BASE_WIDTH, 0.82), 1.12);

      root.style.setProperty("--ui-scale", scale.toFixed(3));
      root.style.setProperty("--pane-width", `${width}px`);
      root.style.setProperty("--pane-height", `${height}px`);
      root.dataset.compact = width < 320 ? "true" : "false";
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(document.body);

    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
}
