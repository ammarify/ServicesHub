// Page numbers to show: always the first and last page, the current one with
// its neighbours, and "…" for the gaps. Never more than seven slots.
export function pageItems(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

  let start = Math.max(2, page - 1);
  let end = Math.min(totalPages - 1, page + 1);
  if (page <= 3) {
    start = 2;
    end = 4;
  }
  if (page >= totalPages - 2) {
    start = totalPages - 3;
    end = totalPages - 1;
  }

  const items = [1];
  if (start > 2) items.push("gap-start");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < totalPages - 1) items.push("gap-end");
  items.push(totalPages);
  return items;
}
