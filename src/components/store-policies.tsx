import { PLATFORM_CONTACT } from "@/lib/legal";
import { deliveryWindow } from "@/lib/delivery";

export function StoreShippingCopy() {
  const window = deliveryWindow();
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Shipping</h1>
      <p>We buy from the supplier after you pay and send tracking when it ships.</p>
      <p>
        Typical delivery is {window.short}. We ship within 1 business day. Times are estimates — customs
        can add a few days.
      </p>
      <p>If a parcel is lost or stuck past the window, we reship or refund.</p>
    </article>
  );
}

export function StoreRefundsCopy() {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Refunds and returns</h1>
      <p>You have 30 days after delivery to ask for a refund or replacement.</p>
      <p>Wrong or damaged items do not need to be sent back. Send a photo and we will reship or refund.</p>
      <p>Card refunds post in 3–7 days depending on the bank.</p>
    </article>
  );
}

export function StoreTermsCopy({ storeName }: { storeName: string }) {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Terms</h1>
      <p>Orders are a sale of the listed goods at the price shown at checkout. Stock is limited.</p>
      <p>Delivery times are estimates. See Shipping for the current window.</p>
      <p>
        These terms apply to purchases on {storeName}. SetoStore the software has its own terms at /terms.
      </p>
    </article>
  );
}

export function StorePrivacyCopy({ email }: { email: string }) {
  const contact = email || PLATFORM_CONTACT.email;
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Privacy</h1>
      <p>We collect the name, email, and shipping address you give at checkout so we can fill the order.</p>
      <p>Card details are handled by Stripe. We do not store full card numbers.</p>
      <p>
        We do not sell your contact details. Email{" "}
        <a className="text-accent" href={`mailto:${contact}`}>
          {contact}
        </a>{" "}
        to ask for a copy or a delete.
      </p>
    </article>
  );
}

export function StoreContactCopy({
  storeName,
  email,
  address,
}: {
  storeName: string;
  email?: string;
  address?: string;
}) {
  const contact = email?.trim() || PLATFORM_CONTACT.email;
  const place = address?.trim() || PLATFORM_CONTACT.address;
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Contact</h1>
      <p>{storeName}</p>
      <p>
        Email{" "}
        <a className="text-accent" href={`mailto:${contact}`}>
          {contact}
        </a>
      </p>
      <p>{place}</p>
    </article>
  );
}
