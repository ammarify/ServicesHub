import { Counter } from "../models/Counter.js";

const MAX_ATTEMPTS = 5;

async function highestExistingNumber(Model, prefix) {
  // numericOrdering collation so "TK-9" sorts before "TK-10".
  const last = await Model.findOne({ code: new RegExp(`^${prefix}-\\d+$`) })
    .sort({ code: -1 })
    .collation({ locale: "en_US", numericOrdering: true })
    .select("code")
    .lean();

  return last ? parseInt(last.code.split("-")[1], 10) : 0;
}

async function incrementCounter(prefix) {
  return Counter.findOneAndUpdate({ _id: prefix }, { $inc: { seq: 1 } }, { returnDocument: "after" }).lean();
}

// Hands out the next sequence number for a prefix atomically ($inc on a
// counters document), so concurrent creates can never be given the same
// code. The counter is seeded lazily from the highest code already stored,
// which keeps existing databases working without a migration.
async function nextSequence(Model, prefix) {
  const counter = await incrementCounter(prefix);
  if (counter) return counter.seq;

  const start = await highestExistingNumber(Model, prefix);
  try {
    await Counter.create({ _id: prefix, seq: start });
  } catch (err) {
    // Another request created it first - fine, just increment below.
    if (err.code !== 11000) throw err;
  }
  return (await incrementCounter(prefix)).seq;
}

// Moves the counter past every code already stored (used if a code turns out
// to be taken, e.g. after documents were inserted outside the API).
async function resyncCounter(Model, prefix) {
  const highest = await highestExistingNumber(Model, prefix);
  await Counter.updateOne({ _id: prefix }, { $max: { seq: highest } }, { upsert: true });
}

export async function generateNextCode(Model, prefix) {
  return `${prefix}-${await nextSequence(Model, prefix)}`;
}

function isDuplicateCodeError(err) {
  return err?.code === 11000 && (err.keyPattern?.code || /code_1/.test(err.message ?? ""));
}

// Creates a document with the next free code, retrying on the (rare) chance
// the code already exists.
export async function createWithCode(Model, prefix, buildDocument) {
  for (let attempt = 1; ; attempt += 1) {
    const code = await generateNextCode(Model, prefix);
    try {
      return await Model.create(buildDocument(code));
    } catch (err) {
      if (!isDuplicateCodeError(err) || attempt >= MAX_ATTEMPTS) throw err;
      await resyncCounter(Model, prefix);
    }
  }
}
