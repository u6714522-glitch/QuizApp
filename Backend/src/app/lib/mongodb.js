import { MongoClient } from "mongodb";

const options = {};
let globalClientPromise;

export function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Please add your MongoDB URI to .env.local");
  }

  if (process.env.NODE_ENV === "developement") {
    if (!globalClientPromise) {
      const client = new MongoClient(uri, options);

      globalClientPromise = client.connect();
    }

    return globalClientPromise;
  } else {
    const client = new MongoClient(uri, options);

    return client.connect();
  }
}
