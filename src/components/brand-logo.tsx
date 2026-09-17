import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">SetoStore</span>
    </span>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-sm font-bold text-white",
        className,
      )}
    >
      S
    </span>
  );
}
