import { ReactNode } from "react";

export type StoryCardProps = {
  numberLabel: string;
  characterName: string;
  hostName: string;
  story: ReactNode;
  footer?: ReactNode;
};

export function StoryCard({ numberLabel, characterName, hostName, story, footer }: StoryCardProps) {
  return (
    <article className="space-y-6 rounded-[32px] border border-divider bg-[rgba(237,241,241,0.04)] p-6 text-textSecondary">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] opacity-70">{numberLabel}</p>
        <h2 className="heading-prosty">{characterName}</h2>
        <p className="text-sm opacity-75">{hostName}</p>
      </header>
      <div className="space-y-4 text-sm leading-relaxed">{story}</div>
      {footer ? <footer className="text-xs opacity-70">{footer}</footer> : null}
    </article>
  );
}

export default StoryCard;
