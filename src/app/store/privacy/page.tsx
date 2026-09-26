export default function StorePrivacyPage() {
  return (
    <article className="prose-sm max-w-2xl space-y-3 text-sm text-muted">
      <h1 className="text-2xl font-semibold text-ink">Privacy</h1>
      <p>We collect the name, email, and shipping address you give at checkout so we can fill the order.</p>
      <p>Card details are handled by Stripe. We do not store full card numbers.</p>
      <p>We do not sell your contact details. Email support@seto.store to ask for a copy or a delete.</p>
    </article>
  );
}
