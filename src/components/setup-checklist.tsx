import { DeskLink } from "@/components/desk-link";
import { Card, CardHeader } from "@/components/ui";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  href: string;
};

export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card id="setup">
      <CardHeader
        eyebrow="First-run checklist"
        title={`${done} of ${steps.length} ready`}
        action={
          <DeskLink href="/settings" className="text-xs text-accent">
            Open Settings →
          </DeskLink>
        }
      />
      <ul className="divide-y divide-line">
        {steps.map((step) => (
          <li key={step.id}>
            <DeskLink
              href={step.href}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-black/[0.02]"
            >
              <span className={step.done ? "text-muted line-through" : "text-ink"}>{step.label}</span>
              <span className={`font-mono text-[11px] ${step.done ? "text-profit" : "text-faint"}`}>
                {step.done ? "Done" : "Next"}
              </span>
            </DeskLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
