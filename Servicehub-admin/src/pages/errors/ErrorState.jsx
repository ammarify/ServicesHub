// A whole-page "you can't be here" message: what happened, why, and the way
// back.
export function ErrorState({ icon: Icon, code, title, description, actions }) {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
        <Icon size={24} />
      </span>
      {code && <div className="font-data mt-5 text-[12px] text-text-secondary">{code}</div>}
      <h1 className="mt-1.5 text-[20px] font-semibold text-text-primary">{title}</h1>
      <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-text-secondary">{description}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
