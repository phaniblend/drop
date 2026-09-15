"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-loss">Something broke</p>
      <h1 className="mt-3 text-2xl font-semibold">The operator desk hit an error</h1>
      <p className="mt-3 text-sm text-muted">{error.message}</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button tone="line" onClick={() => router.push("/")}>
          Back to command
        </Button>
      </div>
    </div>
  );
}
