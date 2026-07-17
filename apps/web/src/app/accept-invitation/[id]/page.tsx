"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient, useSession } from "@/lib/auth-client";

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (isPending || !session) return;
    if (attempted.current) return;
    attempted.current = true;

    authClient.organization.acceptInvitation({ invitationId: id }).then(({ error: acceptError }) => {
      if (acceptError) {
        setError(acceptError.message ?? "Could not accept this invitation");
        return;
      }
      window.location.href = "/clusters";
    });
  }, [isPending, session, id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join organization</CardTitle>
          <CardDescription>You&apos;ve been invited to join a team on MongoOps Cloud.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-critical-fg">{error}</p>}
          {!isPending && !session && (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>Sign in or create an account to accept this invitation.</p>
              <div className="flex gap-3">
                <Link href={`/sign-in?invite=${id}`} className="font-medium text-primary">
                  Sign in
                </Link>
                <Link href={`/sign-up?invite=${id}`} className="font-medium text-primary">
                  Sign up
                </Link>
              </div>
            </div>
          )}
          {(isPending || session) && !error && (
            <p className="text-sm text-muted-foreground">Accepting invitation...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
