import { Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";

const MAX_HEIGHT = 112;

export function MessageComposer({ value, onChange, onSend, onTyping }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          onTyping?.();
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Type a reply... (⌘/Ctrl + Enter to send)"
        className="max-h-[112px] flex-1 resize-none overflow-y-auto rounded-card border border-border bg-surface px-3 py-2 text-[13px] leading-relaxed text-text-primary placeholder:text-text-secondary"
      />
      <Button variant="primary" onClick={handleSend} disabled={!value.trim()}>
        <Send size={14} />
        Send
      </Button>
    </div>
  );
}
