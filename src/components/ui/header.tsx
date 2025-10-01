import Link from "next/link";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type HeaderAction =
  | {
      type: "button";
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      showArrow?: boolean;
    }
  | {
      type: "link";
      label: string;
      href: string;
      disabled?: boolean;
      showArrow?: boolean;
    };

export type HeaderProps = {
  title: string;
  leading?: ReactNode;
  action?: HeaderAction;
};

function HeaderActionButton({ action }: { action: HeaderAction }) {
  if (action.type === "link") {
    return (
      <Link href={action.href} aria-disabled={action.disabled} tabIndex={action.disabled ? -1 : 0}>
        <Button disabled={action.disabled} showArrow={action.showArrow}>
          {action.label}
        </Button>
      </Link>
    );
  }

  return (
    <Button type="button" onClick={action.onClick} disabled={action.disabled} showArrow={action.showArrow}>
      {action.label}
    </Button>
  );
}

export function Header({ title, leading, action }: HeaderProps) {
  return (
    <header className="flex h-[72px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        {leading}
        <h1 className="heading-prosty">{title}</h1>
      </div>
      {action ? <HeaderActionButton action={action} /> : null}
    </header>
  );
}

export default Header;
