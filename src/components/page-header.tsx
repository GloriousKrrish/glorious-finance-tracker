import { ReactNode } from "react";

export function PageHeader({ title, subtitle, action, actions }: { title: ReactNode; subtitle?: string; action?: ReactNode; actions?: ReactNode }) {
  const trailing = actions ?? action;
  return _pageHeaderInner(title, subtitle, trailing);
}

function _pageHeaderInner(title: ReactNode, subtitle: string | undefined, trailing: ReactNode) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 px-6 py-6 md:flex-row md:items-end md:justify-between md:gap-4 md:px-10 md:py-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing && <div className="flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
