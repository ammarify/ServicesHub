import { cloneElement, isValidElement, useId } from "react";

// Label + control + hint/error, with the ids wired up for screen readers.
// The single child (Input, Select, Textarea...) receives id/aria props.
export function FormField({ label, hint, error, children, className }) {
  const generatedId = useId();
  const isElement = isValidElement(children);
  const controlId = (isElement && children.props.id) || generatedId;
  const messageId = `${controlId}-message`;
  const message = error || hint;

  const control = isElement
    ? cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? messageId : undefined,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={controlId} className="mb-1.5 block text-[13px] text-text-secondary">
        {label}
      </label>
      {control}
      {message && (
        <p id={messageId} className={error ? "mt-1 text-[12px] text-danger" : "mt-1 text-[12px] text-text-secondary"}>
          {message}
        </p>
      )}
    </div>
  );
}
