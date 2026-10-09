import { ObjectId } from "mongodb";

export async function parseObjectId(params, key) {
  const value = (await params)[key];

  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}
