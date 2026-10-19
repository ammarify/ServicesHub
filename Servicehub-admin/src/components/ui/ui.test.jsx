import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";
import { StatusBadge } from "./StatusBadge";

function rangeText(text) {
  return (_, element) => element?.tagName === "P" && element.textContent === text;
}

describe("Pagination", () => {
  it("shows which rows are visible out of the total and moves between pages", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} pageSize={12} total={55} totalPages={5} onPageChange={onPageChange} label="bookings" />);

    expect(screen.getByText(rangeText("Showing 13–24 of 55 bookings"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await userEvent.click(screen.getByRole("button", { name: "Page 5" }));
    expect(onPageChange.mock.calls).toEqual([[3], [1], [5]]);
  });

  it("disables the edges", () => {
    render(<Pagination page={5} pageSize={12} total={55} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText(rangeText("Showing 49–55 of 55 results"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("still shows the total when everything fits on one page, without page controls", () => {
    render(<Pagination page={1} pageSize={10} total={7} totalPages={1} onPageChange={() => {}} label="refunds" />);
    expect(screen.getByText(rangeText("Showing 1–7 of 7 refunds"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("changes the number of rows per page", async () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination page={1} pageSize={10} total={55} totalPages={6} onPageChange={() => {}} onPageSizeChange={onPageSizeChange} />
    );
    await userEvent.selectOptions(screen.getByLabelText("Rows per page"), "25");
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });

  it("renders nothing for an empty list", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={0} totalPages={0} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DataTable", () => {
  it("opens a row with the keyboard as well as the mouse", async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={[{ key: "name", label: "Name" }]}
        data={[{ id: "1", name: "Crystal Howard" }]}
        getRowKey={(row) => row.id}
        onRowClick={onRowClick}
      />
    );

    const row = screen.getByText("Crystal Howard").closest("tr");
    row.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it("marks the sorted column for assistive technology", () => {
    render(
      <DataTable
        columns={[{ key: "amount", label: "Amount", sortable: true }]}
        data={[]}
        getRowKey={(row) => row.id}
        sortKey="amount"
        sortDirection="desc"
        onSortChange={() => {}}
        emptyState={<EmptyState title="No bookings yet" />}
      />
    );
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByText("No bookings yet")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("is an accessible modal that focuses its first field", () => {
    render(
      <ConfirmDialog open onClose={() => {}} title="Cancel booking" description="This can't be undone." onSubmit={() => {}}>
        <input aria-label="Reason" />
      </ConfirmDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Cancel booking" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("This can't be undone.");
    expect(screen.getByLabelText("Reason")).toHaveFocus();
  });

  it("closes on Escape without letting the key reach a drawer underneath", () => {
    const onClose = vi.fn();
    const onDrawerKeyDown = vi.fn();
    render(
      <div onKeyDown={onDrawerKeyDown}>
        <ConfirmDialog open onClose={onClose} title="Reject refund">
          <p>Body</p>
        </ConfirmDialog>
      </div>
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDrawerKeyDown).not.toHaveBeenCalled();
  });

  it("submits with Enter when it wraps a form", async () => {
    const onSubmit = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Rename"
        onSubmit={onSubmit}
        footer={<button type="submit">Save</button>}
      >
        <input aria-label="Name" />
      </ConfirmDialog>
    );

    await userEvent.type(screen.getByLabelText("Name"), "New name{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", () => {
    render(<ConfirmDialog open={false} onClose={() => {}} title="Hidden" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("shows the status as a readable label", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.queryByText(/in_progress/)).not.toBeInTheDocument();
  });
});
