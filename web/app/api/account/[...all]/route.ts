import { getAuth } from "@/lib/better-auth";

// Better Auth uses node:crypto + the libSQL client — Node runtime, not edge.
export const runtime = "nodejs";

// getAuth() creates Better Auth's tables on first use, the same way every other
// route creates the app's tables through ready().
async function handle(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
