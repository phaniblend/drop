"use client";

import { useState } from "react";
import { Button } from "./ui";

export function CopyButton({
  text,
  label = "Copy",
  disabled = false,
}: {
  text: string;
  label?: string;
  disabled?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      tone="line"
      className="h-8 px-2.5 text-xs"
      disabled={disabled}
      onClick={async () => {
        if (disabled) return;
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}
