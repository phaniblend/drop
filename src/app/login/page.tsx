import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui";
import { signInWithGoogle } from "@/app/actions/auth";
import { env } from "@/lib/env";

function errorCopy(code?: string) {
  if (code === "AccessDenied" || code === "desk_claimed") {
    return "This desk already belongs to another Google account.";
  }
  if (code === "Configuration") {
    return "Google Sign-In is not configured yet. Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET to .env.local.";
  }
  if (code === "OAuthCallback" || code === "OAuthAccountNotLinked") {
    return "Google rejected the sign-in. Check that the redirect URI is http://localhost:3000/api/auth/callback/google.";
  }
  if (code) return "Could not sign in with Google. Try again.";
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ready = Boolean(env.googleId.length > 12 && env.googleSecret.length > 12 && env.authSecret);
  const message = errorCopy(error);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-[0_18px_50px_rgba(15,18,34,0.08)]">
        <BrandLogo />
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Sign in to your desk</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          One Google account claims this operator desk. There is no separate signup or password — the first
          successful Google sign-in becomes the owner.
        </p>
        {message ? (
          <p className="mt-4 rounded-xl border border-loss/30 bg-loss/5 px-3 py-2 text-sm text-loss">{message}</p>
        ) : null}
        {ready ? (
          <form action={signInWithGoogle} className="mt-6">
            <Button type="submit" tone="accent" className="w-full">
              <GoogleMark />
              Continue with Google
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-3">
            <Button type="button" tone="accent" disabled className="w-full">
              <GoogleMark />
              Continue with Google
            </Button>
            <p className="text-xs leading-5 text-muted">
              Add <code className="font-mono text-[11px]">AUTH_GOOGLE_ID</code> and{" "}
              <code className="font-mono text-[11px]">AUTH_GOOGLE_SECRET</code> from a Google Cloud OAuth web
              client. Authorized redirect:{" "}
              <code className="font-mono text-[11px]">http://localhost:3000/api/auth/callback/google</code>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.7 7.2l6.3 5.3C38.2 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}
