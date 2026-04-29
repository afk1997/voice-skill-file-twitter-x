import clsx from "clsx";

export function SpoolWordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-baseline gap-2 font-display italic tracking-normal text-ink", className)}>
      <span>Spool</span>
      <span
        aria-hidden="true"
        className="inline-block size-[0.55em] rounded-full border-[1.5px] border-accent shadow-[inset_0_0_0_0.16em_var(--paper),inset_0_0_0_0.2em_var(--ink)]"
      />
    </span>
  );
}
