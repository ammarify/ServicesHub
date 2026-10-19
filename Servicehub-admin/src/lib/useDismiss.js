import { useEffect } from "react";

// Closes a popover/menu on an outside click or Escape. Shared by the user
// menu, row menus, the notifications panel and the range picker.
// `refs` is one ref or a list of them (e.g. a trigger and a menu portaled
// elsewhere in the page); a press inside any of them doesn't count as outside.
export function useDismiss(refs, isOpen, onDismiss) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const list = Array.isArray(refs) ? refs : [refs];

    function handlePointerDown(event) {
      const inside = list.some((ref) => ref.current?.contains(event.target));
      if (!inside) onDismiss();
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // `refs` may be a new array each render; the refs inside it are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onDismiss]);
}
