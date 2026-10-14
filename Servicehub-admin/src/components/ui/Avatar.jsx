import { initials } from "../../lib/formatters";

export function Avatar({ name, size = 28 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-accent/10 font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}
