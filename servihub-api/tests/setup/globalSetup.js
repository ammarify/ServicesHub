import { MongoMemoryServer } from "mongodb-memory-server-core";

// One MongoDB for the whole run; every test file then works in its own
// randomly named database (see tests/helpers/db.js), so files can run in
// parallel without touching each other's data.
//
// Set MONGODB_TEST_URI to use an existing server instead (CI uses a MongoDB
// service container this way). Otherwise mongodb-memory-server downloads a
// MongoDB binary on first use and caches it.
export default async function setup(project) {
  if (process.env.MONGODB_TEST_URI) {
    project.provide("mongoUri", process.env.MONGODB_TEST_URI);
    return undefined;
  }

  const server = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION ?? "7.0.14" },
  });
  project.provide("mongoUri", server.getUri());

  return async () => {
    await server.stop();
  };
}
