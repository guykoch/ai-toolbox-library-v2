import { ConvexError } from "convex/values";

// Every function takes the access key you set in the Convex dashboard
// (environment variable ADMIN_KEY). Without it, nobody can read or change the library.
export function checkKey(key: string) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ConvexError("ADMIN_KEY is not set in the Convex dashboard (Settings → Environment Variables).");
  }
  if (key !== expected) {
    throw new ConvexError("Wrong access key.");
  }
}
