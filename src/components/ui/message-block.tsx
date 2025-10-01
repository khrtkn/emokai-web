import { ReactNode } from "react";

export type MessageBlockProps = {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
};

export function MessageBlock({ title, body, footer }: MessageBlockProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-divider bg-[rgba(237,241,241,0.04)] p-6 text-sm text-textSecondary">
      <h2 className="gradient-text text-lg font-semibold" style={{ fontFamily: '"Prosty", "Inter", sans-serif' }}>
        {title}
      </h2>
      <div className="space-y-2">{body}</div>
      {footer ? <footer className="text-xs opacity-80">{footer}</footer> : null}
    </section>
  );
}

export default MessageBlock;
