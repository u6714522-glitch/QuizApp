import { createHash, randomBytes } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";

let client;

try {
  const parsed = z.string().trim().email().safeParse(process.argv[2]);

  if (!parsed.success) throw new Error("Provide a valid instructor email.");

  if (!process.argv[3]) {
    throw new Error("Provide the frontend URL as the second argument.");
  }

  const email = parsed.data;
  const site = new URL(process.argv[3]);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(site.hostname);

  if (
    site.username ||
    site.password ||
    (site.protocol !== "https:" && !(site.protocol === "http:" && local))
  ) {
    throw new Error("Use HTTPS, or HTTP with localhost for local development.");
  }

  if (!process.env.MONGODB_URI || !process.env.DB_NAME) {
    throw new Error("MONGODB_URI and DB_NAME are required in the environment file.");
  }

  client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();

  const db = client.db(process.env.DB_NAME);
  const users = db.collection("users");
  const invitations = db.collection("invitations");

  if (await users.findOne({ email })) {
    throw new Error("This email already has an account. Use a new email.");
  }

  await users.createIndex({ email: 1 }, { unique: true });
  await invitations.createIndex({ tokenHash: 1 }, { unique: true });

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

  await invitations.insertOne({
    email,
    role: "instructor",
    userId: new ObjectId(),
    tokenHash,
    createdAt,
    expiresAt,
    usedAt: null,
  });

  const link = new URL("/web-page/register-instructor", site.origin);

  link.searchParams.set("token", token);

  console.log("Invitation created for:", email);
  console.log("Expires at:", expiresAt.toISOString());
  console.log("Registration link:", link.href);
} catch (error) {
  console.error("Cannot create invitation:", error.message);
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}