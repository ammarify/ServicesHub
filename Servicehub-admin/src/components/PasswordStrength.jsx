import clsx from "clsx";
import { passwordStrength } from "../lib/passwordRules";

const BAR_CLASSES = ["bg-danger", "bg-warning", "bg-info", "bg-success"];
const TEXT_CLASSES = ["text-danger", "text-warning", "text-info", "text-success"];

// A three-segment meter under a new-password field.
export function PasswordStrength({ password }) {
  const strength = passwordStrength(password);
  if (!strength) return null;
  const filled = Math.max(strength.level, 1);

  return (
    <div className="flex items-center gap-3">
      <div className="grid flex-1 grid-cols-3 gap-1" aria-hidden="true">
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={clsx("h-1 rounded-full transition-colors", segment <= filled ? BAR_CLASSES[strength.level] : "bg-border")}
          />
        ))}
      </div>
      <span className={clsx("shrink-0 text-[12px] font-medium", TEXT_CLASSES[strength.level])}>
        <span className="sr-only">Password strength: </span>
        {strength.label}
      </span>
    </div>
  );
}
