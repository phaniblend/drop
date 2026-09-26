import { PLATFORM_CONTACT } from "@/lib/legal";
import { getStorefrontBrand } from "@/lib/storefront";

export default async function StoreContactPage() {
  const brand = await getStorefrontBrand();
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Contact</h1>
      <p>{brand.name}</p>
      <p>
        Email{" "}
        <a className="text-accent" href={`mailto:${PLATFORM_CONTACT.email}`}>
          {PLATFORM_CONTACT.email}
        </a>
      </p>
      <p>{PLATFORM_CONTACT.address}</p>
    </article>
  );
}
