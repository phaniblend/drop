"use client";

import { useState, useTransition } from "react";
import { saveMetaAdAccount } from "@/app/actions/settings";
import { Button, inputClass } from "./ui";

export function MetaAdAccountPicker({
  accounts,
  selectedId = "",
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
  selectedId?: string;
}) {
  const [value, setValue] = useState(selectedId || accounts[0]?.id || "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  if (!accounts.length) return null;

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2/60 p-3">
      <p className="text-xs font-medium text-ink">Ad account for Margin Guard</p>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.id}) · {a.currency}
          </option>
        ))}
      </select>
      <Button
        type="button"
        tone="line"
        className="h-8 px-3 text-xs"
        disabled={pending || !value}
        onClick={() =>
          start(async () => {
            setMsg("");
            try {
              const res = await saveMetaAdAccount(value);
              setMsg(res.message);
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Could not save ad account.");
            }
          })
        }
      >
        {pending ? "Saving…" : "Use this ad account"}
      </Button>
      {msg ? <p className="text-xs text-profit">{msg}</p> : null}
    </div>
  );
}
