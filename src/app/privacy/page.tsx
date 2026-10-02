import Link from "next/link";
import { PLATFORM_CONTACT } from "@/lib/legal";

export default function PlatformPrivacyPage() {
  const appUrl = (process.env.APP_URL || "https://www.seto.store").replace(/\/$/, "");
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

      <h2 className="mt-8 text-lg font-semibold text-ink">Meta / Facebook data</h2>
      <p className="mt-3">
        When you connect Meta Login, Seto stores an encrypted long-lived access token, your Meta user id,
        and ad account metadata so Ads & Guard can read insights and (if you opt in) pause losing ad sets.
      </p>
      <p className="mt-3">
        Meta App Review data-deletion callback:{" "}
        <code className="font-mono text-[12px] text-ink">{appUrl}/api/meta/data-deletion</code>
      </p>
      <p className="mt-3">
        OAuth redirect URI for the Facebook app:{" "}
        <code className="font-mono text-[12px] text-ink">{appUrl}/api/meta/callback</code>
      </p>
      <p className="mt-3">
        Deleting via Meta&apos;s flow revokes the stored token and marks the connection revoked. You can
        also disconnect from Settings → Meta ads.
      </p>

      <p className="mt-6">
        <Link href="/terms" className="text-accent">
          Terms
        </Link>
      </p>
    </main>
  );
}
