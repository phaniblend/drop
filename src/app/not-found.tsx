import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-faint">404</p>
      <h1 className="mt-3 text-2xl font-semibold">That screen is not on the desk</h1>
      <p className="mt-3 text-sm text-muted">The route does not exist in SetoStore.</p>
      <Link href="/" className="mt-6 inline-block">
        <Button>Return to command</Button>
      </Link>
    </div>
  );
}
