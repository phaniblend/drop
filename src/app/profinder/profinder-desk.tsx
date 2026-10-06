"use client";

import { useState } from "react";
import type { ProfinderLead } from "@/lib/profinder-search";

export function ProfinderDesk() {
  const [leads, setLeads] = useState<ProfinderLead[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  function ping(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function findProspects() {
    setBusy(true);
    try {
      const res = await fetch("/api/profinder/search", { method: "POST", credentials: "include" });
      const data = (await res.json()) as { leads?: ProfinderLead[]; warning?: string; error?: string };
      if (!res.ok) {
        ping(data.error || "Search is not available.");
        return;
      }
      setLeads(data.leads ?? []);
      ping(
        data.leads?.length
          ? `Queued ${data.leads.length} live Reddit prospects.`
          : data.warning || "No matching comments in this pull.",
      );
    } catch {
      ping("Could not reach the search.");
    } finally {
      setBusy(false);
    }
  }

  async function copyScript(handle: string) {
    const script = `Hey ${handle}, saw your comment about wanting to get into e-commerce without burning cash on ads. A small engineering team just launched an automated micro-operator platform called Seto. It has built-in margin protection that automatically shuts off losing ads before they spend more than $35.\n\nThey're letting the next 20 people test their first 5 customer sales 100% free with no credit card required. Thought it might save you some tuition money: seto.store?ref=operator. Cheers!`;
    await navigator.clipboard.writeText(script);
    ping(`Script copied for u/${handle}`);
  }

  return (
    <div className="profinder-root min-h-dvh bg-[#090d16] px-6 py-6 text-[#f9fafb]">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-[#374151] bg-[#111827] px-6 py-5">
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              findprospects.com
              <span className="rounded border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold uppercase text-sky-500">
                Seto Lead Engine
              </span>
            </h1>
            <p className="mt-1 text-[13px] text-[#9ca3af]">
              Live Reddit comments from dropship / Shopify / side-hustle threads.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[13px] text-[#9ca3af]">
              Pending Leads: <strong className="font-mono text-[#f9fafb]">{leads.length}</strong>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void findProspects()}
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Searching Reddit…" : "Find the Prospects"}
            </button>
          </div>
        </header>

        <main className="flex flex-col gap-4">
          {leads.length === 0 ? (
            <div className="rounded-lg border border-[#374151] bg-[#111827] px-6 py-12 text-center text-[15px] text-[#9ca3af]">
              Click Find the Prospects to pull live high-intent comments.
            </div>
          ) : (
            leads.map((p) => (
              <article key={p.id} className="flex flex-col gap-3.5 rounded-lg border border-[#374151] bg-[#111827] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded bg-[#ff4500] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                      {p.platform}
                    </span>
                    <span className="text-[15px] font-bold">u/{p.handle}</span>
                    <span className="rounded border border-[#374151] bg-[#1f2937] px-2 py-0.5 text-xs text-[#9ca3af]">
                      {p.category}
                    </span>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[13px] font-bold text-emerald-500">
                    {p.score}% Intent Match
                  </span>
                </div>
                <blockquote className="rounded-r-md border-l-[3px] border-sky-600 bg-[#0d131f] px-3.5 py-3 text-[13px] italic leading-5 text-[#d1d5db]">
                  “{p.context}”
                </blockquote>
                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={p.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-[#374151] bg-[#1f2937] px-3 py-1.5 text-[13px] font-semibold text-sky-400"
                  >
                    Open Profile ↗
                  </a>
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-[#374151] bg-[#1f2937] px-3 py-1.5 text-[13px] font-semibold text-sky-400"
                  >
                    View Comment Source ↗
                  </a>
                  <button
                    type="button"
                    className="rounded border border-[#374151] bg-[#1f2937] px-3.5 py-1.5 text-[13px] font-semibold"
                    onClick={() => void copyScript(p.handle)}
                  >
                    Copy Seto Invite Script
                  </button>
                  <button
                    type="button"
                    className="ml-auto rounded bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white"
                    onClick={() => {
                      setLeads((cur) => cur.filter((row) => row.id !== p.id));
                      ping("Prospect marked as contacted and removed from queue.");
                    }}
                  >
                    Mark Contacted ✓
                  </button>
                </div>
              </article>
            ))
          )}
        </main>
      </div>
      {toast ? (
        <div className="fixed bottom-6 right-6 rounded-md border border-[#374151] border-l-4 border-l-emerald-500 bg-[#1f2937] px-4 py-3 text-[13px] shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
