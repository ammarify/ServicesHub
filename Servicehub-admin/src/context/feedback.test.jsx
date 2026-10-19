import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmProvider, useConfirm } from "./ConfirmContext";
import { ToastProvider, useToast } from "./ToastContext";

function ConfirmProbe({ options, onResult }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onResult(await confirm(options))}>
      Delete it
    </button>
  );
}

function renderConfirm(options) {
  const onResult = vi.fn();
  render(
    <ToastProvider>
      <ConfirmProvider>
        <ConfirmProbe options={options} onResult={onResult} />
      </ConfirmProvider>
    </ToastProvider>
  );
  return onResult;
}

describe("useConfirm", () => {
  it("runs the action after confirmation and resolves true", async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    const onResult = renderConfirm({ title: "Delete Zara?", confirmLabel: "Delete provider", tone: "danger", onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    expect(screen.getByRole("dialog", { name: "Delete Zara?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete provider" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resolves false when the person backs out, without running the action", async () => {
    const onConfirm = vi.fn();
    const onResult = renderConfirm({ title: "Delete Zara?", onConfirm });

    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and explains a failure", async () => {
    const error = Object.assign(new Error("Request failed"), {
      response: { status: 409, data: { message: "Busy Bee has 1 booking on record, so the profile can't be deleted." } },
    });
    const onResult = renderConfirm({ title: "Delete Busy Bee?", confirmLabel: "Delete provider", onConfirm: () => Promise.reject(error) });

    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete provider" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Busy Bee has 1 booking on record");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onResult).not.toHaveBeenCalled();
  });
});

function ToastProbe() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success("Booking BK-4853 updated.")}>
        Save
      </button>
      <button type="button" onClick={() => toast.error("That provider is off duty.", { title: "Couldn't assign" })}>
        Fail
      </button>
    </>
  );
}

describe("toasts", () => {
  it("confirms an action and can be dismissed", async () => {
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Booking BK-4853 updated.");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces errors with a title and dismisses itself", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <ToastProbe />
      </ToastProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't assign");
    expect(screen.getByRole("alert")).toHaveTextContent("That provider is off duty.");

    await act(async () => {
      vi.advanceTimersByTime(7100);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
