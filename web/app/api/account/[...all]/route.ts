import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth uses node:crypto + the libSQL client — Node runtime, not edge.
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
