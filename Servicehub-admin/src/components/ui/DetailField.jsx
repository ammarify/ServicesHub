import clsx from "clsx";

export function DetailField({ label, children, mono = false }) {
  return (
    <div>
      <div className="text-[12px] text-text-secondary">{label}</div>
      <div className={clsx("mt-0.5 text-[13px] text-text-primary", mono && "font-data")}>
        {children}
      </div>
    </div>
  );
}
