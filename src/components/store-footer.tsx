import Link from "next/link";
import { STORE_POLICIES } from "@/lib/legal";

export function StoreFooter({
  storeName,
  stripeMode = "off",
}: {
  storeName: string;
  stripeMode?: "off" | "test" | "live";
}) {
  return (
    <footer className="mt-12 border-t border-line py-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted">
        <p>
          {storeName}
          {stripeMode === "test" ? " · Card checkout is in test mode" : ""}
        </p>
        <nav className="flex flex-wrap gap-3">
          {STORE_POLICIES.map((item) => (
            <Link key={item.href} href={item.href} className="text-accent">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
