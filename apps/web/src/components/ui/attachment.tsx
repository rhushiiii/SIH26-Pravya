import type { ReactNode } from "react";

export type AttachmentState =
  "idle" | "uploading" | "processing" | "error" | "done";

/** Composition adapted from crysta1221's 21st.dev Attachment component: https://21st.dev/@crysta1221/components/attachment */
export function Attachment({
  state,
  children,
  className = "",
}: {
  state: AttachmentState;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`attachment ${className}`}
      data-slot="attachment"
      data-state={state}
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function AttachmentMedia({ children }: { children: ReactNode }) {
  return (
    <div className="attachment-media" aria-hidden="true">
      {children}
    </div>
  );
}

export function AttachmentContent({ children }: { children: ReactNode }) {
  return <div className="attachment-content">{children}</div>;
}

export function AttachmentTitle({ children }: { children: ReactNode }) {
  return <span className="attachment-title">{children}</span>;
}

export function AttachmentDescription({ children }: { children: ReactNode }) {
  return <span className="attachment-description">{children}</span>;
}
