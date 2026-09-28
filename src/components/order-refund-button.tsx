"use client";

import { useTransition } from "react";
import { requestOrderRefund } from "@/app/actions/orders";
import { Button } from "./ui";

export function OrderRefundButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      tone="loss"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await requestOrderRefund(orderId);
        })
      }
    >
      {pending ? "Opening refund…" : "Start refund"}
    </Button>
  );
}
