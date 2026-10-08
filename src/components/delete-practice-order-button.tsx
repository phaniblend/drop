"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deletePracticeOrder } from "@/app/actions/orders";

export function DeletePracticeOrderButton({
  orderId,
  redirectTo = "/orders",
}: {
  orderId: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="mt-1 text-[11px] text-loss hover:underline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deletePracticeOrder(orderId);
          router.push(redirectTo);
          router.refresh();
        })
      }
    >
      {pending ? "Deleting…" : "Delete practice order"}
    </button>
  );
}
