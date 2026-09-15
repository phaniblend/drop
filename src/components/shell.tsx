"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  Megaphone,
  PackageSearch,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  Warehouse,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

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

export function Shell({
  children,
  storeName,
  liveCount,
}: {
  children: React.ReactNode;
  storeName: string;
  liveCount: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-bg-elev/90 px-3 py-5">
        <Link href="/" className="mb-6 px-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">DropshipOS</p>
          <p className="mt-1 text-sm font-semibold text-ink">{storeName}</p>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                  active
                    ? "bg-[rgba(74,163,255,0.12)] text-ink"
                    : "text-muted hover:bg-white/5 hover:text-ink",
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-accent" : "text-faint")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="rounded-xl border border-line bg-surface px-3 py-3">
          <p className="text-[11px] uppercase tracking-wider text-faint">Connections</p>
          <p className="mt-1 text-sm text-ink">
            {liveCount === 0 ? "Demo mode" : `${liveCount} live API${liveCount === 1 ? "" : "s"}`}
          </p>
          <Link href="/settings" className="mt-2 inline-block text-xs text-accent hover:text-accent-2">
            Connect stores →
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <PackageSearch className="h-4 w-4 text-faint" />
            Operator desk
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={liveCount ? "profit" : "accent"}>{liveCount ? "Live mix" : "Demo data"}</Badge>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
