import { ReactNode } from "react";

export type InstructionBannerProps = {
  children: ReactNode;
  tone?: "default" | "warning" | "error";
  marquee?: boolean;
};

const toneClassName: Record<NonNullable<InstructionBannerProps["tone"]>, string> = {
  default: "bg-[rgba(237,241,241,0.08)] text-textPrimary",
  warning: "bg-[rgba(255,199,0,0.12)] text-textPrimary",
  error: "bg-[rgba(255,77,79,0.16)] text-[#ffb9b9]"
};

export function InstructionBanner({ children, tone = "default", marquee }: InstructionBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl px-4 py-3 text-sm ${toneClassName[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {marquee ? (
        <div className="animate-marquee whitespace-nowrap">{children}</div>
      ) : (
        <div className="whitespace-normal">{children}</div>
      )}
    </div>
  );
}

export default InstructionBanner;
