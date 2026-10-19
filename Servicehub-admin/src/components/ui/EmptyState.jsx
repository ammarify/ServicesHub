// What a list shows when there is nothing in it: what's missing, and the
// next step when there is one.
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center text-center">
      {Icon && (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <p className="text-[13px] font-medium text-text-primary">{title}</p>
      {description && <p className="mt-1 max-w-[340px] text-[13px] text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
