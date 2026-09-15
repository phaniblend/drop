import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-line bg-surface/90 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

type Tone = "default" | "accent" | "profit" | "loss" | "warn" | "ghost" | "line";

const btnTone: Record<Tone, string> = {
  default: "bg-ink text-bg hover:bg-white",
  accent: "bg-accent text-[#041018] hover:bg-accent-2 font-semibold",
  profit: "bg-profit text-[#062016] hover:brightness-110",
  loss: "bg-loss text-[#2a0408] hover:brightness-110",
  warn: "bg-warn text-[#2a1c02] hover:brightness-110",
  ghost: "bg-transparent text-ink hover:bg-white/5",
  line: "border border-line bg-surface-2 text-ink hover:border-line-strong",
};

export function Button({
  className,
  tone = "default",
  type = "button",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        btnTone[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "line",
  className,
}: {
  children: React.ReactNode;
  tone?: "line" | "accent" | "profit" | "loss" | "warn";
  className?: ClassValue;
}) {
  const tones = {
    line: "border-line bg-surface-2 text-muted",
    accent: "border-accent/30 bg-[rgba(74,163,255,0.12)] text-accent-2",
    profit: "border-profit/25 bg-[rgba(62,224,160,0.12)] text-profit",
    loss: "border-loss/25 bg-[rgba(255,107,122,0.12)] text-loss",
    warn: "border-warn/25 bg-[rgba(240,180,41,0.12)] text-warn",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none ring-accent/40 placeholder:text-faint focus:border-accent focus:ring-2";

export function Kpi({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "profit" | "loss" | "warn";
}) {
  const color = {
    ink: "text-ink",
    profit: "text-profit",
    loss: "text-loss",
    warn: "text-warn",
  }[tone];
  return (
    <Card className="px-5 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className={cn("mt-2 font-mono text-xl font-semibold tabular sm:text-2xl", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
