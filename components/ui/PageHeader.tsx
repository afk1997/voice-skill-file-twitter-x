import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b-[1.5px] border-ink pb-6 md:flex-row md:items-start">
      <div>
        {eyebrow ? <p className="font-mono text-[10px] font-semibold uppercase tracking-normal text-accent">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-4xl font-semibold leading-none tracking-normal text-ink md:text-5xl">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
