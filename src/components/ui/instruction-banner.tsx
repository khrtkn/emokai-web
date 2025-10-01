import { ReactNode } from "react";

export type InstructionBannerProps = {
  children: ReactNode;
  tone?: "default" | "warning" | "error";
  marquee?: boolean;
  icon?: ReactNode;
};

const toneClassName: Record<NonNullable<InstructionBannerProps["tone"]>, string> = {
  default: "bg-[rgba(237,241,241,0.08)] text-textPrimary",
  warning: "bg-[rgba(255,199,0,0.12)] text-textPrimary",
  error: "bg-[rgba(255,77,79,0.16)] text-[#ffb9b9]"
};

export function InstructionBanner({ children, tone = "default", marquee, icon }: InstructionBannerProps) {
  const defaultIcon = tone === "error" ? "⚠" : tone === "warning" ? "⚠" : null;
  const iconNode = icon ?? defaultIcon;

  return (
    <div
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-sm ${toneClassName[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {iconNode ? (
        <span className="shrink-0 text-base" aria-hidden>
          {iconNode}
        </span>
      ) : null}
      {marquee ? (
        <div className="flex-1 overflow-hidden">
          <div className="animate-marquee whitespace-nowrap group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex-1 whitespace-normal">{children}</div>
      )}
    </div>
  );
}

export default InstructionBanner;
