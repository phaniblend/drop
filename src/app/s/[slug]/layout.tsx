import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreShell } from "@/components/store-shell";
import { StoreFooter } from "@/components/store-footer";
import { getUserBySlug } from "@/lib/db/queries";
import { stripeCheckoutMode } from "@/lib/stripe-mode";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) return { title: "Store" };
  return {
    title: user.storeName,
    description: `${user.storeName} — tracked shipping, pay by card.`,
  };
}

export default async function SlugStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  return (
    <StoreShell storeName={user.storeName}>
      {children}
      <StoreFooter
        storeName={user.storeName}
        stripeMode={stripeCheckoutMode(user.storeStripeSk || env.stripeSecretKey)}
      />
    </StoreShell>
  );
}
