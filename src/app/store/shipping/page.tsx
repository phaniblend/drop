import { deliveryWindow } from "@/lib/delivery";

export default function StoreShippingPage() {
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
