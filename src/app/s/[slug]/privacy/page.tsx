import { notFound } from "next/navigation";
import { StorePrivacyCopy } from "@/components/store-policies";
import { getUserBySlug } from "@/lib/db/queries";

export default async function SlugPrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  return <StorePrivacyCopy email={user.supportEmail?.trim() || user.email} />;
}
