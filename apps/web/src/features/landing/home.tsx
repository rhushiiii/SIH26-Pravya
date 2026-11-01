"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { motion } from "framer-motion";
import { CipherReveal } from "@/components/fx/cipher-reveal";
import { CapabilityDeck } from "@/features/landing/capability-deck";
import { usePrefersReducedMotion as useReducedMotion } from "@/components/fx/use-fx";
import {
  CategoryBars,
  MetricCard,
  StatusDonut,
} from "@/features/dashboards/components";
import { MagneticButton, Marquee, Reveal, StaggerGroup } from "@/components/fx";

const pillars = [
  {
    title: "One workspace",
    body: "Upload, validation, review and activation live in a single traceable flow instead of scattered spreadsheets and emails.",
  },
  {
    title: "Evidence, not guesswork",
    body: "Every flag carries a rule code and redacted evidence. Officers review leads with context, not bare rejections.",
  },
  {
    title: "Nothing is overwritten",
    body: "Every submission is kept as an immutable version. A correction is a new version sitting alongside the old one, not a silent edit.",
  },
];

const steps = [
  {
    title: "Upload Records",
    body: "An institution administrator submits a complete admissions snapshot as a structured CSV. The upload is stored as an immutable candidate.",
  },
  {
    title: "Validate Rules",
    body: "Local APAAR format checks and configured intake rules run against the candidate, producing a deterministic, repeatable result.",
  },
  {
    title: "Flag Exceptions",
    body: "Missing fields, format issues and potential cross-institution duplicates are surfaced as evidence-linked findings — leads, not verdicts.",
  },
  {
    title: "Review & Resolve",
    body: "An officer reviews findings in context, can request verification or open a case, and the institution's correction becomes a new version.",
  },
];

const features = [
  {
    title: "APAAR format validation",
    body: "Structural checks run locally against configured rules. Explicitly labeled as local format checking, never official government identity verification.",
  },
  {
    title: "Admission record management",
    body: "Every uploaded batch is stored as a permanent, append-only version, with full provenance of who submitted what and when.",
  },
  {
    title: "Intake rule checks",
    body: "Declared admissions are compared against configured category and seat-capacity rules, with missing configuration surfaced rather than assumed.",
  },
  {
    title: "Evidence-linked review",
    body: "Findings carry rule codes and redacted evidence. A finding is a lead for officer review, never an automatic determination.",
  },
  {
    title: "Exception tracking",
    body: "Officers can open a case against specific records, request a correction, and track its resolution on an append-only timeline.",
  },
  {
    title: "Audit trails and accountability",
    body: "Snapshot activation requires explicit review and acknowledgment. Every state-changing action is recorded with actor and timestamp.",
  },
];

const security = [
  {
    title: "Role-based access",
    body: "Institution administrators, AICTE officers and managers each see only what their role permits — enforced on every backend request, not just hidden in the UI.",
  },
  {
    title: "Full traceability",
    body: "Immutable submission versions and append-only audit events mean every record's history can be reconstructed, not just its latest state.",
  },
  {
    title: "Reviewed, accountable decisions",
    body: "Snapshot activation requires an explicit reviewer and acknowledgment of any omissions before it can replace the current declaration.",
  },
  {
    title: "Clear limits of local validation",
    body: "Local APAAR format checks are structural only. Simulated identity verification is always labeled as such and never presented as official government verification.",
  },
];

const capabilities = [
  "Immutable submission versions",
  "HMAC token duplicate matching",
  "Per-category intake caps",
  "Evidence-linked findings",
  "Ed25519 signed demo credentials",
  "Append-only audit trail",
  "Masked APAAR everywhere",
  "Role-scoped APIs",
];

const journey = [
  {
    title: "Upload",
    icon: "upload",
    heading: "A new version. A clear starting point.",
    body: "Keep the submitted file as an immutable candidate before running any checks.",
    tag: "CANDIDATE",
    detail: "synthetic_admissions.csv",
    lines: [
      "Programme and year attached",
      "Original submission preserved",
      "Current snapshot stays unchanged",
    ],
  },
  {
    title: "Validate",
    icon: "grid",
    heading: "Understand what needs attention.",
    body: "Local checks turn missing fields and potential overlaps into evidence you can follow.",
    tag: "LOCAL CHECKS",
    detail: "Evidence attached to each finding",
    lines: [
      "APAAR format, checked locally",
      "Configured intake rules compared",
      "Potential duplicates surfaced for review",
    ],
  },
  {
    title: "Review",
    icon: "flag",
    heading: "See the context before deciding.",
    body: "Compare the candidate with the current snapshot and review changes, warnings and omissions.",
    tag: "REVIEW RECEIPT",
    detail: "Current snapshot → candidate version",
    lines: [
      "Changes and omissions made visible",
      "Warnings acknowledged explicitly",
      "Review tied to a specific version",
    ],
  },
  {
    title: "Activate",
    icon: "history",
    heading: "A deliberate handover. A lasting trail.",
    body: "Explicit confirmation makes the reviewed candidate current while preserving earlier versions.",
    tag: "EXPLICIT CONFIRMATION",
    detail: "Reviewed candidate → current snapshot",
    lines: [
      "Only eligible candidates can activate",
      "Actor and timestamp recorded",
      "Previous declarations remain in history",
    ],
  },
] as const;

function HeroJourney() {
  const [selected, setSelected] = useState(0);
  const step = journey[selected];
  return (
    <div className="admission-journey" data-ui>
      <div className="journey-topline">
        <span className="journey-status-dot" aria-hidden="true" />
        <span>THE LIFE OF A SUBMISSION</span>
        <span>Interactive illustration</span>
      </div>
      <div className="journey-intro">
        <p className="eyebrow">FROM FILE TO CONFIDENCE</p>
        <h2>Every record has a journey.</h2>
        <p>Choose a stage to see what happens next.</p>
      </div>
      <div
        className="journey-selector"
        role="group"
        aria-label="Explore submission stages"
      >
        {journey.map((item, index) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={selected === index}
            aria-controls="journey-detail"
            onClick={() => setSelected(index)}
          >
            <span className="journey-step-icon">
              <Icon name={item.icon} />
            </span>
            <span>{item.title}</span>
            <small>0{index + 1}</small>
          </button>
        ))}
      </div>
      <div
        className="journey-detail"
        id="journey-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="journey-detail-label">
          <span>{step.tag}</span>
          <Icon name={step.icon} />
        </div>
        <h3>{step.heading}</h3>
        <p>{step.body}</p>
        <div className="journey-document">
          <Icon name={step.icon} />
          <span>{step.detail}</span>
        </div>
        <ul>
          {step.lines.map((line) => (
            <li key={line}>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m4 10 4 4 8-8" />
              </svg>
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="journey-footer">
        <Icon name="history" />
        <span>Every version preserved. Every decision traceable.</span>
      </div>
      <p className="journey-disclaimer">
        Illustration only · synthetic data · local validation
      </p>
    </div>
  );
}

export function LandingPage() {
  const reduce = useReducedMotion();
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <motion.div
          className="landing-hero-content"
          initial={reduce ? undefined : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="eyebrow hero-eyebrow">CLARITY AT EVERY STEP</p>
          <h1 className="hero-headline">
            <CipherReveal text="Admissions," />
            <br />
            <CipherReveal text="with clarity." delay={350} />
          </h1>
          <p className="landing-lede hero-lede">
            From the first upload to the final review. Bring your admission
            records, local checks and evidence together in one thoughtful
            workspace.
          </p>
          <div className="landing-cta">
            <MagneticButton>
              <Link className="button primary" href="/login">
                Open workspace <Icon name="arrow" />
              </Link>
            </MagneticButton>
            <a className="button secondary ghost" href="#how-it-works">
              How It Works
            </a>
          </div>
          <div className="hero-assurance">
            <span>
              <Icon name="history" /> Every version preserved
            </span>
            <span>
              <Icon name="flag" /> Every finding explained
            </span>
          </div>
          <p className="hero-demo-note">
            SYNTHETIC DEMO · NO GOVERNMENT VERIFICATION
          </p>
        </motion.div>
        <motion.div
          id="how-it-works"
          className="hero-visual hero-journey-shell"
          initial={reduce ? undefined : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        >
          <HeroJourney />
        </motion.div>
        <a
          href="#overview"
          className="scroll-indicator"
          aria-label="Scroll to content"
        >
          <span />
        </a>
      </section>

      <div className="landing-process-strip" aria-label="Admissions workflow">
        {steps.map((step, index) => (
          <a href="#how-it-works" key={step.title}>
            <span className="process-number">0{index + 1}</span>
            <span>{step.title}</span>
            <Icon name="arrow" />
          </a>
        ))}
      </div>

      <Marquee ariaLabel="Platform capabilities">
        {capabilities.map((capability) => (
          <span className="fx-marquee-chip" key={capability}>
            {capability}
          </span>
        ))}
      </Marquee>

      <section className="landing-section" id="overview">
        <Reveal className="landing-section-heading page-heading">
          <p className="eyebrow">OVERVIEW</p>
          <h2>One Workspace. Clearer Decisions.</h2>
          <p>
            PRAVYA brings admissions intake, local validation and officer review
            into one traceable workspace, so every decision can be explained
            after the fact.
          </p>
        </Reveal>
        <div className="pillar-grid">
          {pillars.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 90}>
              <article className="pillar-card">
                <span className="card-index">0{index + 1} / THE PRINCIPLE</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="features">
        <Reveal className="landing-section-heading page-heading">
          <p className="eyebrow">CAPABILITIES</p>
          <h2>Built around evidence, not assumptions</h2>
          <p>
            All data shown anywhere in this platform is synthetic. Nothing here
            is, or claims to be, connected to a real government system.
          </p>
        </Reveal>
        <CapabilityDeck items={features} />
      </section>

      <section className="landing-section" id="preview">
        <Reveal className="landing-section-heading page-heading">
          <p className="eyebrow">PLATFORM PREVIEW</p>
          <h2>What the workspace looks like</h2>
          <p>
            An illustrative preview of the institution dashboard layout. This is
            not live data — sign in to see your own permitted workspace.
          </p>
        </Reveal>
        <Reveal className="preview-shell">
          <div className="preview-badge">
            Illustrative preview · not live data
          </div>
          <div className="dashboard-metrics preview-metrics">
            <StaggerGroup>
              <MetricCard
                label="Current declared records"
                value="1,240"
                note="Demo figure. Activated snapshots only; candidates and history excluded"
              />
              <MetricCard
                label="Active enrolments"
                value="1,118"
                note="Demo figure. Internal status accounting, not official policy"
              />
              <MetricCard
                label="Programme coverage"
                value="26"
                note="Demo figure. Illustrative; missing is not zero"
              />
            </StaggerGroup>
          </div>
          <div className="preview-grid">
            <div className="preview-panel">
              <p className="chart-subheading">
                Records by reservation category
              </p>
              <CategoryBars
                categories={[
                  { label: "General/Open", value: 612 },
                  { label: "SC/ST", value: 214 },
                  { label: "NT", value: 168 },
                  { label: "OBC", value: 246 },
                  { label: "PwD (overlapping)", value: 38 },
                ]}
              />
            </div>
            <div className="preview-panel">
              <p className="chart-subheading">Status breakdown</p>
              <StatusDonut
                statuses={[
                  { label: "ACTIVE", value: 1118 },
                  { label: "INACTIVE", value: 122 },
                ]}
                total={1240}
              />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="landing-section roles-section" id="roles">
        <Reveal className="landing-section-heading page-heading">
          <p className="eyebrow">ONE PLATFORM · DIFFERENT VIEWS</p>
          <h2>Designed around the work each role actually does</h2>
          <p>
            The same evidence model gives each permitted user a focused view,
            with server-side scope enforced behind every screen.
          </p>
        </Reveal>
        <div className="role-preview-grid">
          {[
            [
              "Institution administrator",
              "Submit a complete snapshot, understand findings, and prepare a correction without losing history.",
              "UPLOAD → VALIDATE → REVIEW",
            ],
            [
              "AICTE officer",
              "Compare evidence across institutions, open cases, and make accountable review decisions.",
              "ASSESS → INVESTIGATE → DECIDE",
            ],
            [
              "AICTE manager",
              "See aggregate coverage and trends without exposing student-level records.",
              "MONITOR → COMPARE → ACT",
            ],
            [
              "Authorized verifier",
              "Check a signed demo credential with a clear simulated provenance boundary.",
              "VERIFY → TRACE → REPORT",
            ],
          ].map(([title, body, flow], index) => (
            <Reveal key={title} delay={index * 70}>
              <article className="role-preview-card">
                <span className="role-preview-index">0{index + 1}</span>
                <span className="role-preview-flow">{flow}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section" id="security">
        <Reveal className="landing-section-heading page-heading">
          <p className="eyebrow">SECURITY &amp; TRUST</p>
          <h2>Built to be accountable, not just functional</h2>
        </Reveal>
        <div className="security-grid">
          {security.map((entry, index) => (
            <Reveal key={entry.title} delay={index * 80}>
              <article className="security-card">
                <h3>{entry.title}</h3>
                <p>{entry.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-quote" aria-label="Design principle">
        <motion.blockquote
          className="pull-quote"
          initial={reduce ? undefined : { opacity: 0, scale: 0.97, y: 14 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p>
            “A finding is a lead for review, never a verdict. PRAVYA keeps the
            evidence, the versions and the audit trail, so the decision — and
            the accountability — stays with the officer.”
          </p>
          <footer>PRAVYA design principle · synthetic data only</footer>
        </motion.blockquote>
      </section>

      <section className="landing-final-cta">
        <motion.div
          initial={reduce ? undefined : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          <h2>Bring Clarity to Every Admission.</h2>
          <p>
            Sign in to open your permitted workspace and see the review flow end
            to end.
          </p>
          <MagneticButton>
            <Link className="button primary large" href="/login">
              Sign In / Access Workspace
            </Link>
          </MagneticButton>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <strong>PRAVYA</strong>
          <span>Admissions Review &amp; Compliance Platform</span>
        </div>
        <p>
          Synthetic data only. No APAAR identity or government verification is
          performed by this platform.
        </p>
        <nav className="landing-footer-links" aria-label="Footer navigation">
          <a href="#overview">Overview</a>
          <a href="#features">Capabilities</a>
          <a href="#preview">Preview</a>
          <a href="#roles">Roles</a>
          <a href="#security">Security</a>
          <Link href="/login">Sign in</Link>
        </nav>
      </footer>
    </main>
  );
}
