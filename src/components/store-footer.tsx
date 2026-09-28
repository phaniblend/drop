import Link from "next/link";

const POLICIES = [
  { suffix: "shipping", label: "Shipping" },
  { suffix: "refunds", label: "Refunds" },
  { suffix: "privacy", label: "Privacy" },
  { suffix: "terms", label: "Terms" },
  { suffix: "contact", label: "Contact" },
] as const;

export function StoreFooter({
  storeName,
  homeHref = "/store",
  stripeMode = "off",
}: {
  storeName: string;
  homeHref?: string;
  stripeMode?: "off" | "test" | "live";
}) {
  const base = homeHref.replace(/\/$/, "") || "/store";
  return (
    <footer className="mt-12 border-t border-line py-8">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted">
        <p>
          {storeName}
          {stripeMode === "test" ? " · Card checkout is in test mode" : ""}
        </p>
        <nav className="flex flex-wrap gap-3">
          {POLICIES.map((item) => (
            <Link key={item.suffix} href={`${base}/${item.suffix}`} prefetch={false} className="text-accent">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
