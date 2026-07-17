"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession } from "@/lib/auth-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();
  const [resolvingOrg, setResolvingOrg] = useState(false);
  const attemptedAutoSelect = useRef(false);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    if (session.session.activeOrganizationId) return;
    if (attemptedAutoSelect.current) return;
    attemptedAutoSelect.current = true;

    setResolvingOrg(true);
    authClient.organization
      .list()
      .then(async ({ data: orgs }) => {
        if (orgs && orgs.length > 0) {
          await authClient.organization.setActive({ organizationId: orgs[0].id });
          await refetch();
        } else {
          router.replace("/onboarding");
        }
      })
      .finally(() => setResolvingOrg(false));
  }, [isPending, session, router, refetch]);

  if (isPending || !session || !session.session.activeOrganizationId || resolvingOrg) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
