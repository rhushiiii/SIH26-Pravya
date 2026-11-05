"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { homeFor, useSession, type Role } from "@/features/auth/session";
import { BrandMark } from "@/components/brand-mark";
import { DataNotice, Loading } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { NotificationBell } from "@/features/notifications/bell";

const roleNames: Record<Role, string> = {
  INSTITUTION_ADMIN: "Institution administrator",
  AICTE_OFFICER: "AICTE officer",
  AICTE_MANAGER: "AICTE manager",
  AUTHORIZED_VERIFIER: "Authorized verifier",
};

export function Protected({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const { session } = useSession();
  const router = useRouter();
  const allowed = session && roles.includes(session.user.role);
  useEffect(() => {
    if (!session) router.replace("/login");
    else if (!allowed) router.replace("/access-denied");
  }, [session, allowed, router]);
  if (!allowed)
    return (
      <div className="session-loading">
        <Loading label="Checking local session…" />
      </div>
    );
  return children;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useSession();
  const pathname = usePathname();
  const menu = useRef<HTMLDialogElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    menu.current?.close();
  }, [pathname]);
  if (!session) return null;
  const role = session.user.role;
  const institution = role === "INSTITUTION_ADMIN";
  const officer = role === "AICTE_OFFICER";
  const manager = role === "AICTE_MANAGER";
  const verifier = role === "AUTHORIZED_VERIFIER";
  const destination = homeFor(role);
  const label = verifier
    ? "Verify credential"
    : manager
      ? "Executive dashboard"
      : "Dashboard";
  const verifyLinks = [
    {
      href: "/verify",
      label: "Verify credential",
      icon: "flag" as const,
    },
    {
      href: "/verify/log",
      label: "Verification log",
      icon: "history" as const,
    },
  ];
  const links = verifier
    ? verifyLinks
    : [
        {
          href: destination,
          label,
          icon: institution ? ("grid" as const) : ("building" as const),
        },
        ...(institution
          ? [
              {
                href: "/institution/upload",
                label: "Upload candidate",
                icon: "upload" as const,
              },
              {
                href: "/institution/simulator",
                label: "What-if simulator",
                icon: "grid" as const,
              },
              {
                href: "/institution/integrity",
                label: "Integrity signals",
                icon: "flag" as const,
              },
            ]
          : [
              {
                href: "/aicte/institutions",
                label: manager ? "Institution monitoring" : "Institutions",
                icon: "building" as const,
              },
            ]),
        ...(!institution && !verifier && destination !== "/analytics"
          ? [
              {
                href: "/analytics",
                label: manager ? "Admission analytics" : "Analytics",
                icon: "grid" as const,
              },
            ]
          : []),
        {
          href: "/reports",
          label: "Reports",
          icon: "history" as const,
        },
        ...(manager
          ? [
              {
                href: "/aicte/case-oversight",
                label: "Case oversight",
                icon: "flag" as const,
              },
              {
                href: "/manager/priority",
                label: "Integrity & priority",
                icon: "flag" as const,
              },
              {
                href: "/manager/governance",
                label: "Audit & governance",
                icon: "history" as const,
              },
            ]
          : []),
        ...(officer
          ? [
              {
                href: "/audit",
                label: "Audit explorer",
                icon: "history" as const,
              },
            ]
          : []),
        ...(institution || officer
          ? [
              {
                href: "/submissions",
                label: "Submissions",
                icon: "history" as const,
              },
              {
                href: "/records",
                label: "Student registry",
                icon: "grid" as const,
              },
              {
                href: "/credentials",
                label: "Credentials",
                icon: "flag" as const,
              },
            ]
          : []),
        ...(officer
          ? [
              {
                href: "/verification",
                label: "APAAR verification",
                icon: "building" as const,
              },
              ...verifyLinks,
            ]
          : []),
        ...(institution || officer
          ? [
              {
                href: "/cases",
                label: "Cases",
                icon: "flag" as const,
              },
              {
                href: "/reconciliations",
                label: "Reconciliations",
                icon: "flag" as const,
              },
              {
                href: "/notifications",
                label: "Notifications",
                icon: "bell" as const,
              },
            ]
          : []),
      ];
  const currentLink = [...links]
    .filter(
      (link) =>
        link.href === pathname ||
        (link.href !== destination && pathname.startsWith(`${link.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
  const currentLabel = currentLink?.label ?? label;

  const navigationGroups = [
    {
      heading: "Workspace",
      links: links.filter((link) =>
        [
          destination,
          "/institution/upload",
          "/institution/simulator",
          "/aicte/institutions",
          "/analytics",
        ].includes(link.href),
      ),
    },
    {
      heading: "Review & records",
      links: links.filter(
        (link) =>
          [
            "/submissions",
            "/records",
            "/credentials",
            "/verification",
            "/verify",
            "/verify/log",
            "/cases",
            "/aicte/case-oversight",
            "/manager/priority",
            "/institution/integrity",
          ].includes(link.href) && link.href !== destination,
      ),
    },
    {
      heading: "Governance",
      links: links.filter((link) =>
        [
          "/reports",
          "/audit",
          "/manager/governance",
          "/reconciliations",
          "/notifications",
        ].includes(link.href),
      ),
    },
  ].filter((group) => group.links.length > 0);

  const navigation = (
    <>
      <nav aria-label="Main navigation" className="app-navigation">
        {navigationGroups.map((group) => (
          <section className="app-navigation-group" key={group.heading}>
            <h2>{group.heading}</h2>
            {group.links.map((link) => {
              const isCurrent = currentLink?.href === link.href;
              return (
                <Link
                  key={link.href}
                  className={`nav-link ${isCurrent ? "active" : ""}`}
                  href={link.href}
                  aria-label={link.label}
                  title={link.label}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => menu.current?.close()}
                >
                  <Icon name={link.icon} />
                  <span className="sidebar-link-label">{link.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="tiny-label">SECURE WORKSPACE</span>
        <strong>{roleNames[session.user.role]}</strong>
        <p>Synthetic accounts. Backend permissions apply to every request.</p>
        <button
          className="sign-out"
          aria-label="Sign out"
          title="Sign out"
          onClick={signOut}
        >
          <Icon name="exit" />
          <span className="sidebar-link-label">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="portal-layout" data-sidebar-collapsed={sidebarCollapsed}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="sidebar-header">
          <Link
            href={destination}
            className="sidebar-brand"
            aria-label="PRAVYA admissions workspace"
            title="PRAVYA admissions workspace"
          >
            <BrandMark tagline="Admissions workspace" />
          </Link>
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar`}
            aria-expanded={!sidebarCollapsed}
            title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar`}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <span aria-hidden="true">{sidebarCollapsed ? "›" : "‹"}</span>
          </button>
        </div>
        {navigation}
      </aside>
      <div className="portal-main">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-only"
              aria-label="Open navigation"
              onClick={() => menu.current?.showModal()}
            >
              <Icon name="menu" />
            </button>
            <span>
              Workspace <span aria-hidden="true">/</span>{" "}
              <strong>{currentLabel}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <div className="workspace-health" aria-label="Workspace status">
              <span className="workspace-health-dot" aria-hidden="true" />
              <span>Local demo environment</span>
            </div>
            <NotificationBell />
            <div className="account-label">
              <span className="account-dot" aria-hidden="true">
                {roleNames[role]
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")}
              </span>
              <span>
                <strong>{roleNames[role]}</strong>
                <small>Signed in · Demo account</small>
              </span>
            </div>
          </div>
        </header>
        <DataNotice />
        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="portal-footer">
          PRAVYA
          <span>
            Institution declarations · Local checks · Traceable history
          </span>
        </footer>
      </div>
      <dialog
        ref={menu}
        className="mobile-navigation"
        aria-label="Workspace navigation"
      >
        <button
          className="icon-button close-menu"
          aria-label="Close navigation"
          onClick={() => menu.current?.close()}
        >
          <Icon name="close" />
        </button>
        <Link
          href={destination}
          className="sidebar-brand mobile-dialog-brand"
          aria-label="PRAVYA admissions workspace"
          onClick={() => menu.current?.close()}
        >
          <BrandMark tagline="Admissions workspace" />
        </Link>
        {navigation}
      </dialog>
    </div>
  );
}
