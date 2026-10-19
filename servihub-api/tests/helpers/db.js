import crypto from "node:crypto";
import mongoose from "mongoose";
import { inject } from "vitest";
import * as models from "../../src/models/index.js";

const MODELS = Object.values(models).filter((value) => value?.prototype instanceof mongoose.Model);

// Connects this test file to its own throwaway database and builds every
// index (unique codes, the one-pending-refund-per-booking rule, ...) so tests
// see the same constraints as production.
export async function connectTestDb() {
  const dbName = `servihub_test_${crypto.randomBytes(6).toString("hex")}`;
  await mongoose.connect(inject("mongoUri"), { dbName });
  await Promise.all(MODELS.map((Model) => Model.init()));
}

export async function clearTestDb() {
  await Promise.all(MODELS.map((Model) => Model.deleteMany({})));
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}
