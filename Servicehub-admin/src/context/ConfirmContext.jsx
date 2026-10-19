import { TriangleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { errorMessage } from "../lib/api";

const ConfirmContext = createContext(null);

// One confirmation dialog for the whole app, opened with
//
//   const confirm = useConfirm();
//   const done = await confirm({
//     title: "Delete Crystal Howard?",
//     description: "Their profile is removed for good.",
//     confirmLabel: "Delete provider",
//     tone: "danger",
//     onConfirm: () => deleteProvider.mutateAsync(id),
//   });
//
// `done` is true once onConfirm has finished (or straight away without one)
// and false if the person backs out. While onConfirm runs the button shows
// `pendingLabel`; if it throws, the dialog stays open and shows the error, so
// a failed delete is never reported as done.
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    resolveRef.current?.(false);
    setError("");
    setIsPending(false);
    setRequest(options);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function finish(result) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setRequest(null);
    setIsPending(false);
    setError("");
  }

  function handleCancel() {
    if (isPending) return;
    finish(false);
  }

  async function handleConfirm() {
    if (!request?.onConfirm) {
      finish(true);
      return;
    }
    setIsPending(true);
    setError("");
    try {
      await request.onConfirm();
      finish(true);
    } catch (err) {
      setIsPending(false);
      setError(errorMessage(err));
    }
  }

  const tone = request?.tone ?? "default";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={request !== null}
        onClose={handleCancel}
        title={request?.title}
        icon={request?.icon ?? (tone === "danger" ? TriangleAlert : undefined)}
        tone={tone}
        footer={
          <>
            <Button variant="secondary" onClick={handleCancel} disabled={isPending}>
              {request?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant="primary" tone={tone === "danger" ? "danger" : "default"} onClick={handleConfirm} disabled={isPending}>
              {isPending ? request?.pendingLabel ?? "Working…" : request?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        {(request?.description || error) && (
          <div className="flex flex-col gap-3">
            {request?.description && <div>{request.description}</div>}
            {error && (
              <p role="alert" className="rounded-card border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </ConfirmDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
