"use client";

import {
  Children,
  createContext,
  useContext,
  useMemo,
  type Context,
  type ReactNode,
} from "react";

/**
 * Lets a group of cards stagger their entrance without adding DOM elements
 * (grid layout is preserved): each child is wrapped in a context provider
 * carrying its index. Consumers read `useStaggerIndex()` and translate it
 * into an animation delay (e.g. `index * 60ms`).
 */
export const StaggerContext: Context<{ index: number }> = createContext({
  index: 0,
});

export function useStaggerIndex(step = 60): number {
  const { index } = useContext(StaggerContext);
  return index * step;
}

export function StaggerGroup({ children }: { children: ReactNode }) {
  const staggered = useMemo(
    () =>
      Children.map(children, (child, index) => (
        <StaggerContext.Provider value={{ index }}>
          {child}
        </StaggerContext.Provider>
      )),
    [children],
  );
  return <>{staggered}</>;
}
