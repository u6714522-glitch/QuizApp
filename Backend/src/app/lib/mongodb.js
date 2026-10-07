import { MongoClient } from "mongodb";

export function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Please add your MongoDB URI to environment file");

  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = new MongoClient(uri).connect().catch((err) => {
      globalThis._mongoClientPromise = undefined;
      throw err;
    });
  }

  return globalThis._mongoClientPromise;
}
