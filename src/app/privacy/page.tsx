import Link from "next/link";
import { PLATFORM_CONTACT } from "@/lib/legal";

export default function PlatformPrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">SetoStore privacy</h1>
      <p className="mt-3">
        This page covers the SetoStore desk (the software). Shop purchases use the store Privacy page.
      </p>
      <p className="mt-3">
        We store your Google sign-in, catalog, orders, and the credentials you connect so the desk can
        run. We do not sell that data.
      </p>
      <p className="mt-3">
        Email{" "}
        <a className="text-accent" href={`mailto:${PLATFORM_CONTACT.email}`}>
          {PLATFORM_CONTACT.email}
        </a>{" "}
        to export or delete an account.
      </p>
      <p className="mt-6">
        <Link href="/terms" className="text-accent">
          Terms
        </Link>
      </p>
    </main>
  );
}
