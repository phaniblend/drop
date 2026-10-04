import { deliveryWindow } from "@/lib/delivery";

export function StoreShippingCopy({
  storeName,
  shipWithinDays = 1,
}: {
  storeName?: string;
  shipWithinDays?: number;
}) {
  const window = deliveryWindow();
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Shipping</h1>
      <p>
        {storeName ? `${storeName} buys` : "We buy"} from the supplier after you pay and send tracking when
        the parcel ships.
      </p>
      <p>
        Typical delivery is {window.short}. Orders are placed with the supplier within {shipWithinDays}{" "}
        business day{shipWithinDays === 1 ? "" : "s"}. Times are estimates — customs can add a few days.
      </p>
      <p>If a parcel is lost or stuck past the window, we reship or refund.</p>
    </article>
  );
}

export function StoreRefundsCopy({
  storeName,
  refundDays = 30,
}: {
  storeName?: string;
  refundDays?: number;
}) {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Refunds and returns</h1>
      <p>
        You have {refundDays} days after delivery to ask {storeName || "us"} for a refund or replacement.
      </p>
      <p>
        Wrong or damaged items usually do not need to be sent back. Send a photo of the issue and we will
        reship or refund.
      </p>
      <p>Card refunds post in 3–7 days depending on your bank.</p>
    </article>
  );
}

export function StoreTermsCopy({
  storeName,
  email,
  address,
}: {
  storeName: string;
  email?: string;
  address?: string;
}) {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Terms</h1>
      <p>
        Orders on this site are a sale by <strong className="font-medium text-ink">{storeName}</strong> of
        the listed goods at the price shown at checkout. Stock is limited.
      </p>
      {email || address ? (
        <p>
          Seller contact
          {email ? (
            <>
              :{" "}
              <a className="text-accent" href={`mailto:${email}`}>
                {email}
              </a>
            </>
          ) : null}
          {address ? <> · {address}</> : null}.
        </p>
      ) : null}
      <p>Delivery times are estimates. See Shipping for the current window.</p>
      <p>
        Disputes about an order should be raised with {storeName} first. Card chargebacks follow your card
        network rules. These terms apply to purchases on {storeName}. The SetoStore software platform has
        separate terms at /terms.
      </p>
      <p>Governing law: the seller&apos;s place of business unless local consumer law requires otherwise.</p>
    </article>
  );
}

export function StorePrivacyCopy({
  email,
  storeName,
  hasPixel = false,
}: {
  email: string;
  storeName?: string;
  hasPixel?: boolean;
}) {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Privacy</h1>
      <p>
        {storeName || "This store"} collects the name, email, and shipping address you give at checkout so
        the order can be filled.
      </p>
      <p>Card details are handled by Stripe. Full card numbers are not stored on this site.</p>
      {hasPixel ? (
        <p>
          Advertising pixels (for example Meta) may measure visits and purchases so ads can be improved.
          You can refuse non-essential cookies via your browser settings or any consent banner on this site.
        </p>
      ) : (
        <p>
          If advertising pixels are enabled later, they may measure visits and purchases. Essential cookies
          are used for checkout; you can block non-essential cookies in your browser.
        </p>
      )}
      <p>
        Contact details are not sold. Email{" "}
        {email ? (
          <a className="text-accent" href={`mailto:${email}`}>
            {email}
          </a>
        ) : (
          "the store operator"
        )}{" "}
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
  const contact = email?.trim() || "";
  const place = address?.trim() || "";
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Contact</h1>
      <p className="font-medium text-ink">{storeName}</p>
      {contact ? (
        <p>
          Email{" "}
          <a className="text-accent" href={`mailto:${contact}`}>
            {contact}
          </a>
        </p>
      ) : (
        <p className="text-warn">Support email is not published yet. The store operator must add one in Settings.</p>
      )}
      {place ? <p>{place}</p> : <p className="text-warn">Business address is not published yet.</p>}
    </article>
  );
}
