import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  basePath: "/api/auth",
  plugins: [
    organizationClient(),
    twoFactorClient({ twoFactorPage: "/two-factor" }),
    passkeyClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
