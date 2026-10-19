import clsx from "clsx";

// Three bouncing dots: "someone is typing". Decorative; pair it with text.
export function TypingDots({ className }) {
  return (
    <span aria-hidden="true" className={clsx("inline-flex items-center gap-[3px]", className)}>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="animate-typing-dot h-[5px] w-[5px] rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
