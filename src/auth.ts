import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

const googleReady = Boolean(env.googleId.length > 12 && env.googleSecret.length > 12);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: googleReady
    ? [Google({ clientId: env.googleId, clientSecret: env.googleSecret })]
    : [],
  secret: env.authSecret || "dev-only-set-AUTH_SECRET",
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const { ensureDb } = await import("@/lib/db");
        const { provisionOperator } = await import("@/lib/db/seed");
        const db = await ensureDb();
        await provisionOperator(db, {
          email: user.email,
          displayName: user.name || "Operator",
        });
      } catch {
        /* Desk load provisions again. Never lock a Google account out. */
      }
      return true;
    },
  },
});
