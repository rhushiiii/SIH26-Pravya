"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BrandMark } from "@/components/brand-mark";
import JellyRadio from "@/components/ui/jelly-radio";
import { demoAccounts } from "@/features/auth/accounts";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "how-it-works", label: "How It Works" },
  { id: "features", label: "Features" },
  { id: "preview", label: "Platform Preview" },
  { id: "roles", label: "For Every Role" },
  { id: "security", label: "Security & Trust" },
];

const groups = [
  {
    heading: "Institution administrator",
    accounts: demoAccounts.filter(
      (account) => account.role === "Institution administrator",
    ),
  },
  {
    heading: "AICTE review access",
    accounts: demoAccounts.filter(
      (account) =>
        account.role !== "Institution administrator" &&
        account.role !== "Credential verification access",
    ),
  },
  {
    heading: "Credential verification",
    accounts: demoAccounts.filter(
      (account) => account.role === "Credential verification access",
    ),
  },
];

function SignInMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const id = `sign-in-accounts-${useId()}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="sign-in-menu" ref={containerRef}>
      <motion.button
        type="button"
        className="button primary small"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        initial={false}
        animate={{
          scaleX: reduceMotion ? 1 : open ? 1.06 : 1,
          scaleY: reduceMotion ? 1 : open ? 1.03 : 1,
        }}
        whileTap={reduceMotion ? undefined : { scaleX: 0.94, scaleY: 0.98 }}
        transition={{ type: "spring", stiffness: 580, damping: 24, mass: 0.9 }}
      >
        Sign In
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className="sign-in-dropdown"
            role="group"
            aria-label="Demo accounts by role"
            initial={reduceMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <p className="sign-in-dropdown-title">Choose your account</p>
            {groups.map((group) => (
              <div key={group.heading} className="sign-in-group">
                <p className="sign-in-group-label">{group.heading}</p>
                {group.accounts.map((account) => (
                  <Link
                    key={account.alias}
                    href={`/login?alias=${account.alias}`}
                    className="sign-in-option"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                  >
                    <span className="account-monogram" aria-hidden="true">
                      {account.monogram}
                    </span>
                    <span>
                      <strong>{account.label}</strong>
                      <small>{account.role}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PublicNav() {
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("overview");
  const onLanding = sections.length > 0;

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!onLanding) return;
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => !!element);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [onLanding]);

  return (
    <header
      className={`public-nav ${scrolled ? "scrolled" : ""}`}
      style={{
        // Keep both declarations intact through the CSS prefix optimizer.
        backdropFilter: "var(--public-nav-backdrop)",
        WebkitBackdropFilter: "var(--public-nav-backdrop)",
      }}
    >
      <Link href="/">
        <BrandMark tagline="Admissions workspace" mark="lightning" />
      </Link>
      <nav aria-label="Primary" className="public-nav-links">
        <JellyRadio
          items={sections.map((section) => ({
            value: section.id,
            label: section.label,
            href: `/#${section.id}`,
          }))}
          value={active}
          onChange={(section) => setActive(section)}
          chipColor="transparent"
          activeColor="var(--ui-accent-action)"
          textColor="var(--ui-text)"
          activeTextColor="#ffffff"
          size="lg"
          gap={6}
          radius={999}
          swell={0.12}
          barge={3}
          shrink={0.025}
          className="nav-jelly"
        />
        <SignInMenu />
      </nav>
      <button
        type="button"
        className="icon-button mobile-only"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <span className={`burger ${menuOpen ? "open" : ""}`} />
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            aria-label="Mobile"
            className="mobile-nav-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
          >
            {sections.map((section) => (
              <motion.a
                key={section.id}
                href={`/#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className={active === section.id ? "active" : ""}
                whileTap={
                  reduceMotion ? undefined : { scaleX: 0.97, scaleY: 1.03 }
                }
                transition={{ type: "spring", stiffness: 580, damping: 24 }}
              >
                {section.label}
              </motion.a>
            ))}
            <SignInMenu onNavigate={() => setMenuOpen(false)} />
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
