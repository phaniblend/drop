"use client";

import { useTransition } from "react";
import { toggleTask } from "@/app/actions/ops";

export function TaskToggle({ id, done, title, detail }: { id: string; done: boolean; title: string; detail?: string | null }) {
  const [pending, start] = useTransition();
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-3 ${done ? "opacity-60" : "bg-bg"} ${pending ? "opacity-70" : ""}`}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#4aa3ff]"
        checked={done}
        onChange={(e) => start(() => toggleTask(id, e.target.checked))}
      />
      <span>
        <span className={`block text-sm ${done ? "line-through text-muted" : "text-ink"}`}>{title}</span>
        {detail ? <span className="mt-0.5 block text-xs text-muted">{detail}</span> : null}
      </span>
    </label>
  );
}
