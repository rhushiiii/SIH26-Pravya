// NOTE: particle-field is deliberately not exported here — it pulls in
// three.js and must be loaded via `dynamic(() => import(
//   "@/components/fx/particle-field"
// ), { ssr: false })` so the landing bundle stays lean.

export { CountUp, parseMetricValue } from "./count-up";
export { MagneticButton } from "./magnetic-button";
export { Marquee } from "./marquee";
export { Reveal } from "./reveal";
export { SpotlightCard } from "./spotlight-card";
export { SplitTextReveal } from "./split-text-reveal";
export { StaggerGroup, useStaggerIndex } from "./stagger-group";
export { useInViewOnce, usePrefersReducedMotion } from "./use-fx";
