import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { env } from "@/lib/env";
import { loadDeskShell } from "@/lib/desk-shell";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const googleOn = Boolean(env.googleId.length > 12 && env.googleSecret.length > 12);
  if (googleOn && !session?.user?.email) redirect("/login");

  const desk = await loadDeskShell({
    email: session?.user?.email || "pending@setostore.local",
    displayName: session?.user?.name || "Operator",
  });
  if ("denied" in desk) redirect("/login?error=AccessDenied");

  return (
    <Shell
      storeName={desk.storeName}
      liveCount={desk.liveCount}
      billing={desk.billing}
      operatorName={desk.displayName}
      operatorImage={session?.user?.image}
    >
      {children}
    </Shell>
  );
}
