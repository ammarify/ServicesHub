import clsx from "clsx";
import { MoreHorizontal, Send, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../../lib/useDismiss";

function MenuItem({ icon: Icon, label, onSelect, danger }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className={clsx(
        "flex w-full items-center gap-2 rounded-btn px-2.5 py-2 text-left text-[13px] transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-text-primary hover:bg-canvas"
      )}
    >
      <Icon size={14} className={danger ? "text-danger" : "text-text-secondary"} />
      {label}
    </button>
  );
}

const MENU_HEIGHT_ESTIMATE = 150;

export function TeamRowMenu({ member, onChangeRole, onToggleStatus, onResendInvite, onRevokeInvite }) {
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const isOpen = position !== null;
  const close = useCallback(() => setPosition(null), []);
  useDismiss([triggerRef, menuRef], isOpen, close);

  // The menu is portaled to <body> so the table's horizontal scroll area
  // can't clip it; it opens upward when the row is near the bottom of the
  // window, and closes if anything scrolls underneath it.
  function toggle() {
    if (isOpen) {
      close();
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE;
    setPosition({
      right: window.innerWidth - rect.right,
      ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, close]);

  function run(action) {
    close();
    action();
  }

  const isPendingInvite = member.invitePending && member.status === "active";

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={`Actions for ${member.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-7 w-7 items-center justify-center rounded-btn text-text-secondary transition-colors hover:bg-canvas hover:text-text-primary"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", ...position }}
            className="animate-dialog-enter z-40 min-w-[190px] rounded-card border border-border bg-surface p-1 shadow-pop"
          >
            <MenuItem icon={ShieldCheck} label="Change role" onSelect={() => run(onChangeRole)} />
            {isPendingInvite ? (
              <>
                <MenuItem icon={Send} label="Resend invitation" onSelect={() => run(onResendInvite)} />
                <div className="my-1 h-px bg-border" role="separator" />
                <MenuItem icon={Trash2} label="Withdraw invitation" onSelect={() => run(onRevokeInvite)} danger />
              </>
            ) : (
              <>
                <div className="my-1 h-px bg-border" role="separator" />
                {member.status === "active" ? (
                  <MenuItem icon={UserX} label="Disable account" onSelect={() => run(onToggleStatus)} danger />
                ) : (
                  <MenuItem icon={UserCheck} label="Enable account" onSelect={() => run(onToggleStatus)} />
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
