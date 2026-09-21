"use client";

import { useEffect, useState } from "react";
import { DeskLink } from "./desk-link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Warehouse,
  ClipboardCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";
import { HelpGuide, HelpMenuButton } from "./help-guide";
import { BrandLogo, BrandMark } from "./brand-logo";
import { TrialBadge } from "./trial-badge";
import { UpgradeModal } from "./upgrade-modal";
import { SignOutButton } from "./sign-out-button";
import type { BillingSummary } from "@/lib/paywall";

const NAV = [
  { href: "/", label: "Command", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Sparkles },
  { href: "/catalog", label: "Catalog", icon: Boxes },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/fulfillment", label: "Fulfill", icon: Truck },
  { href: "/ads", label: "Ads & Guard", icon: Megaphone },
  { href: "/suppliers", label: "Suppliers", icon: Warehouse },
  { href: "/ops", label: "Daily ops", icon: ClipboardCheck },
  { href: "/settings", label: "Settings", icon: Settings },
];

const BOTTOM = [
  { href: "/", label: "Command", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Sparkles },
  { href: "/catalog", label: "Catalog", icon: Boxes },
  { href: "/fulfillment", label: "Fulfill", icon: Truck },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Shell({
  children,
  storeName,
  liveCount,
  billing,
  operatorName,
  operatorImage,
}: {
  children: React.ReactNode;
  storeName: string;
  liveCount: number;
  billing: BillingSummary;
  operatorName?: string;
  operatorImage?: string | null;
}) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [desktop, setDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh">
      {navOpen ? (
        <div
          className="fixed inset-0 z-[85] bg-black/55 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <aside
        inert={!desktop && !navOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-[90] flex w-[min(16.5rem,86vw)] flex-col border-r border-line bg-bg-elev px-3 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] transition-transform duration-200 md:sticky md:top-0 md:h-dvh md:w-[232px] md:translate-x-0 md:pt-5",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-2 px-2">
          <DeskLink href="/" className="min-w-0" onClick={() => setNavOpen(false)}>
            <BrandLogo />
            <p className="mt-1 truncate text-xs text-muted">{storeName}</p>
          </DeskLink>
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-black/[0.04] md:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <DeskLink
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition",
                  active
                    ? "bg-accent/10 text-ink"
                    : "text-muted hover:bg-black/[0.04] hover:text-ink",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-faint")} />
                {item.label}
              </DeskLink>
            );
          })}
          <HelpMenuButton
            active={helpOpen}
            onClick={() => {
              setHelpOpen(true);
              setNavOpen(false);
            }}
          />
        </nav>
        <div className="mt-3 rounded-xl border border-line bg-surface px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
          <p className="text-[11px] uppercase tracking-wider text-faint">Connections</p>
          <p className="mt-1 text-sm text-ink">
            {liveCount === 0 ? "No APIs connected" : `${liveCount} live API${liveCount === 1 ? "" : "s"}`}
          </p>
          <DeskLink href="/settings" className="mt-2 inline-block text-xs text-accent hover:text-accent-2">
            Connect stores →
          </DeskLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))] md:px-6 md:pt-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <button
              type="button"
              className="rounded-lg p-2 text-ink hover:bg-black/[0.04] md:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <BrandMark className="hidden h-7 w-7 text-xs md:inline-flex" />
            <span className="truncate">
              <span className="md:hidden font-medium text-ink">SetoStore</span>
              <span className="hidden md:inline">Operator desk</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {operatorImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={operatorImage}
                alt={operatorName ?? "Operator"}
                className="hidden h-8 w-8 rounded-full border border-line object-cover sm:block"
              />
            ) : null}
            {operatorName ? (
              <span className="hidden max-w-[10rem] truncate text-xs text-muted sm:inline">{operatorName}</span>
            ) : null}
            <TrialBadge billing={billing} />
            <Badge tone={liveCount ? "profit" : "accent"}>{liveCount ? "Live mix" : "Local"}</Badge>
            <SignOutButton className="hidden h-8 px-2.5 text-xs md:inline-flex" />
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-6 md:py-6 md:pb-6">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-[80] grid grid-cols-5 border-t border-line bg-bg-elev/95 px-1 pt-1 backdrop-blur-md pb-[max(0.35rem,env(safe-area-inset-bottom))] md:hidden">
        {BOTTOM.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <DeskLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium",
                active ? "text-accent" : "text-faint",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </DeskLink>
          );
        })}
        <button
          type="button"
          className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium text-faint"
          onClick={() => setNavOpen((open) => !open)}
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>

      <HelpGuide open={helpOpen} onOpenChange={setHelpOpen} />
      <UpgradeModal />
    </div>
  );
}
