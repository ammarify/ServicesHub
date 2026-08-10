// Finds the highest "<prefix>-<n>" code for the given model and returns
// the next one. Uses numericOrdering collation so "TK-9" sorts before
// "TK-10" (plain lexicographic sort would put it after "TK-89"), which
// means no separate counters collection is needed at this scale.
export async function generateNextCode(Model, prefix) {
  const last = await Model.findOne({ code: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ code: -1 })
    .collation({ locale: "en_US", numericOrdering: true })
    .lean();

  const lastNumber = last ? parseInt(last.code.split("-")[1], 10) : 0;
  return `${prefix}-${lastNumber + 1}`;
}
