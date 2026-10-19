import clsx from "clsx";

// Facts about one record (phone, area, rating...) as icon + label + value
// rows. Rows go inside an InfoList, which is the <dl>.
export function InfoList({ className, children }) {
  return <dl className={clsx("flex flex-col", className)}>{children}</dl>;
}

export function InfoRow({ icon: Icon, label, children, mono = false }) {
  return (
    <div className="flex min-h-9 items-center gap-2.5 border-b border-border py-1.5 text-[13px] last:border-0">
      {Icon && <Icon size={14} className="shrink-0 text-text-secondary" aria-hidden="true" />}
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className={clsx("ml-auto min-w-0 truncate text-right text-text-primary", mono && "font-data")}>{children}</dd>
    </div>
  );
}
