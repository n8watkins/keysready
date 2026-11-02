import { createAuthClient } from "better-auth/react";

// In the browser the base URL defaults to the current origin; we only need to
// point it at the same basePath the server handler is mounted on.
export const authClient = createAuthClient({
  basePath: "/api/account",
});

export const { signIn, signUp, signOut, useSession } = authClient;
