import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { unlockProfinder } from "@/app/actions/profinder";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import {
  PROFINDER_COOKIE,
  canOpenProfinder,
  profinderCookieValid,
} from "@/lib/profinder-access";
import { ProfinderDesk } from "./profinder-desk";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profinder — Seto",
  robots: { index: false, follow: false },
};

export default async function ProfinderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    redirect("/login?next=/profinder");
  }
  if (!canOpenProfinder(email)) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
          <BrandLogo />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">Profinder</h1>
          <p className="mt-2 text-sm text-muted">
            Signed in as {email}. This desk is not on the Profinder list. Sign out and use the allowed
            Google account.
          </p>
          <div className="mt-6">
            <SignOutButton className="w-full" />
          </div>
        </section>
      </main>
    );
  }

  const jar = await cookies();
  const unlocked = profinderCookieValid(email!, jar.get(PROFINDER_COOKIE)?.value);
  if (!unlocked) {
    const { error } = await searchParams;
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
        <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8">
          <BrandLogo />
          <h1 className="mt-6 text-xl font-semibold tracking-tight">Profinder</h1>
          <p className="mt-2 text-sm text-muted">Signed in as {email}. Enter the desk password.</p>
          {error ? <p className="mt-3 text-sm text-loss">Wrong password.</p> : null}
          <form action={unlockProfinder} className="mt-6 space-y-3">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={32}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
            />
            <Button type="submit" tone="accent" className="w-full">
              Open Profinder
            </Button>
          </form>
        </section>
      </main>
    );
  }

  return <ProfinderDesk />;
}