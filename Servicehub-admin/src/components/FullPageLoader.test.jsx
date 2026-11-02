import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FullPageLoader } from "./FullPageLoader";

const SLOW_START = /can take up to a minute to start/;

describe("FullPageLoader", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("explains a long wait for the server after a few seconds", () => {
    render(<FullPageLoader waitingForServer />);
    expect(screen.queryByText(SLOW_START)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("status")).toHaveTextContent(SLOW_START);
  });

  it("stays quiet while only loading a page", () => {
    render(<FullPageLoader />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(SLOW_START)).not.toBeInTheDocument();
  });
});
