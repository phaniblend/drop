export default function PublicStoreNotFound() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Store not found</h1>
      <p className="mt-2 text-sm text-muted">That shop link isn’t available.</p>
    </main>
  );
}
