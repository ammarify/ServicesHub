import clsx from "clsx";
import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";

const MAX_HEIGHT = 140;
const MAX_LENGTH = 2000;
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Short replies an agent sends often; one click puts the text in the box,
// where it can still be edited before sending.
const QUICK_REPLIES = [
  { label: "Looking into it", text: "Thanks for reaching out, I'm looking into this now." },
  { label: "Ask for a photo", text: "Sorry about this. Could you share a photo of the issue?" },
  { label: "Update soon", text: "Thanks for your patience, I'll update you shortly." },
];

export function MessageComposer({ value, onChange, onSend, onTyping, isSending, error, disabled, customerFirstName }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const trimmed = value.trim();
  const tooLong = value.length > MAX_LENGTH;
  const canSend = Boolean(trimmed) && !tooLong && !isSending && !disabled;

  function handleSend() {
    if (!canSend) return;
    onSend(trimmed);
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  }

  function insertQuickReply(text) {
    onChange(text);
    textareaRef.current?.focus();
  }

  return (
    <div>
      {!value && !disabled && (
        <div className="mb-2.5 flex gap-2 overflow-x-auto pb-0.5" aria-label="Quick replies">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply.label}
              type="button"
              title={reply.text}
              onClick={() => insertQuickReply(reply.text)}
              className="shrink-0 rounded-btn border border-border bg-surface px-2.5 py-1 text-[12px] text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary"
            >
              {reply.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={clsx(
          "rounded-card border bg-surface transition-[border-color,box-shadow] focus-within:ring-2",
          tooLong || error
            ? "border-danger/60 focus-within:ring-danger/15"
            : "border-border focus-within:border-accent/60 focus-within:ring-accent/15"
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          aria-label="Reply to customer"
          aria-invalid={tooLong || Boolean(error) || undefined}
          placeholder={customerFirstName ? `Reply to ${customerFirstName}…` : "Write a reply…"}
          className="block max-h-[140px] w-full resize-none overflow-y-auto bg-transparent px-3.5 pt-3 text-[13px] leading-relaxed text-text-primary placeholder:text-text-secondary focus-visible:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2.5 pt-1.5">
          <span className="hidden pl-1 text-[11px] text-text-secondary sm:inline">
            <kbd className="font-data rounded-btn border border-border px-1 py-px text-[10px]">{isMac ? "⌘" : "Ctrl"}</kbd>
            {" + "}
            <kbd className="font-data rounded-btn border border-border px-1 py-px text-[10px]">Enter</kbd> to send
          </span>
          <div className="ml-auto flex items-center gap-3">
            {value.length > MAX_LENGTH - 300 && (
              <span className={clsx("font-data text-[11px]", tooLong ? "text-danger" : "text-text-secondary")}>
                {value.length}/{MAX_LENGTH}
              </span>
            )}
            <Button variant="primary" onClick={handleSend} disabled={!canSend}>
              <Send size={14} />
              {isSending ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>

      {(error || tooLong) && (
        <p role={error ? "alert" : undefined} className="mt-1.5 text-[12px] text-danger">
          {error || "That's longer than a message can be."}
        </p>
      )}
    </div>
  );
}
