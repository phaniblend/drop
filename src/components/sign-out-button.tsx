"use client";

import { useTransition } from "react";
import { signOutOperator } from "@/app/actions/auth";
import { Button } from "./ui";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      tone="line"
      className={className}
      disabled={pending}
      onClick={() => start(() => signOutOperator())}
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
