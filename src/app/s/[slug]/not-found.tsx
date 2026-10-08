export default function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">This page isn’t for sale</h1>
      <p className="mt-2 text-sm text-muted">
        The product or store link may be wrong, or the listing isn’t published yet.
      </p>
      <a href="/" className="mt-6 text-sm text-accent underline">
        Go to Seto
      </a>
    </main>
  );
}
