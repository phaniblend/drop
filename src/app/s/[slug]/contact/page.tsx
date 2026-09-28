import { notFound } from "next/navigation";
import { StoreContactCopy } from "@/components/store-policies";
import { getUserBySlug } from "@/lib/db/queries";

export default async function SlugContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getUserBySlug(slug);
  if (!user) notFound();
  return (
    <StoreContactCopy
      storeName={user.storeName}
      email={user.supportEmail?.trim() || user.email}
      address={user.businessAddress ?? ""}
    />
  );
}
