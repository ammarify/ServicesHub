import { CircleAlert } from "lucide-react";
import clsx from "clsx";
import { Button } from "./Button";

export function QueryError({ message = "Something went wrong. Please try again.", onRetry, className }) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 py-10", className)}>
      <CircleAlert size={28} className="text-danger" />
      <p className="max-w-70 text-center text-[13px] text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
