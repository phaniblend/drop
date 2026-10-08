"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function StoreProductNotFound() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const home = slug ? `/s/${slug}` : "/";

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">This product isn’t available</h1>
      <p className="mt-2 text-sm text-muted">
        It may be unpublished, removed, or the link is wrong.
      </p>
      <Link href={home} className="mt-6 text-sm text-accent underline">
        Back to the store
      </Link>
    </main>
  );
}
