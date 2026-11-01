import type { Metadata } from "next";
import { Inter, Literata, DM_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session";

import "./globals.css";
import "./interaction-polish.css";
import "./design-system.css";
import "@/components/shell-redesign.css";
import "@/features/workspace-redesign.css";
import "@/components/ui/feedback-redesign.css";
import "@/components/ui/attachment.css";
import "@/features/landing/landing-redesign.css";
import "@/features/auth/login-redesign.css";

// Interface Mode body font (SF Pro Text substitute). Inter is a variable
// font, so the 400/500/600 weights used by the design system are covered
// without pinning static instances.
const interfaceFont = Inter({
  subsets: ["latin"],
  variable: "--next-font-interface",
  display: "swap",
});
// Editorial Mode accent serif (pull-quotes, mission statements only).
const editorialSerif = Literata({
  subsets: ["latin"],
  variable: "--next-font-literata",
  display: "swap",
});
// Shared technical register (rule IDs, masked APAAR fragments, timestamps).
const technicalMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--next-font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PRAVYA — Admissions Review & Compliance Platform",
  description:
    "APAAR-aware admissions validation, evidence-linked review and auditable decisions for AICTE-approved institutions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${interfaceFont.variable} ${editorialSerif.variable} ${technicalMono.variable}`}
    >
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
