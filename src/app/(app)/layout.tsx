import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { integrationStatus, env } from "@/lib/env";
import { ensureDb } from "@/lib/db";
import { getOperator } from "@/lib/db/queries";
import { provisionOperator } from "@/lib/db/seed";
import { getBillingSummary } from "@/lib/billing";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const googleOn = Boolean(env.googleId.length > 12 && env.googleSecret.length > 12);
  if (googleOn && !session?.user?.email) redirect("/login");

  const db = await ensureDb();
  const claimed = await provisionOperator(db, {
    email: session?.user?.email || "pending@setostore.local",
    displayName: session?.user?.name || "Operator",
  });
  if (!claimed.ok) redirect("/login?error=AccessDenied");

  const [user, integrations, billing] = await Promise.all([
    getOperator(),
    Promise.resolve(integrationStatus()),
    getBillingSummary(),
  ]);
  if (!user) redirect("/login");

  return (
    <Shell
      storeName={user.storeName}
      liveCount={integrations.liveCount}
      billing={billing}
      operatorName={user.displayName}
      operatorImage={session?.user?.image}
    >
      {children}
    </Shell>
  );
}
