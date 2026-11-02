// npm run seed: wipes the database in MONGODB_URI and loads the demo data.
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDB } from "../config/db.js";
import { SEED_ANCHOR_DATE } from "./relativeDates.js";
import { SEED_PASSWORD, seedDatabase } from "./seedData.js";

async function seed() {
  if (env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error("Refusing to wipe and reseed a production database. Re-run with --force if you really mean it.");
    process.exit(1);
  }

  await connectDB();
  const counts = await seedDatabase();

  console.log(`Seed complete (dates shifted from ${SEED_ANCHOR_DATE} to today):`);
  console.table(counts);
  console.log(`All seeded staff accounts use the password ${SEED_PASSWORD}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
