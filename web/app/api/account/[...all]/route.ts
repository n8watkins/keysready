import { getAuth } from "@/lib/better-auth";

// getAuth() creates Better Auth's tables on first use, the same way every other
// route creates the app's tables through ready().
async function handle(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
