import { ReactNode } from "react";

export type ProgressStage = {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
};

const statusColor: Record<ProgressStage["status"], string> = {
  pending: "bg-[rgba(237,241,241,0.15)]",
  active: "bg-accent",
  complete: "bg-accent",
  error: "bg-[#ff7c7c]"
};

const statusIcon: Record<ProgressStage["status"], string> = {
  pending: "",
  active: "…",
  complete: "✓",
  error: "!"
};

export type ProgressBarProps = {
  stages: ProgressStage[];
  footer?: ReactNode;
};

export function ProgressBar({ stages, footer }: ProgressBarProps) {
  return (
    <div className="space-y-3 rounded-3xl border border-divider bg-[rgba(237,241,241,0.04)] p-4 text-textSecondary">
      <ol className="flex flex-col gap-3">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-3 text-sm">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-canvas ${statusColor[stage.status]}`}
            >
              {statusIcon[stage.status]}
            </span>
            <span className="text-textPrimary">{stage.label}</span>
          </li>
        ))}
      </ol>
      {footer ? <div className="text-xs text-textSecondary">{footer}</div> : null}
    </div>
  );
}

export default ProgressBar;
