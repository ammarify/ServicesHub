import clsx from "clsx";

export function Toolbar({ children, className }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-3", className)}>
      {children}
    </div>
  );
}
