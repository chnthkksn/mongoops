"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient, useSession } from "@/lib/auth-client";

type EnrollStep = "password" | "verify";

export function SecurityCard() {
  const { data: session, refetch } = useSession();
  const twoFactorEnabled = Boolean(session?.user?.twoFactorEnabled);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<EnrollStep>("password");
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  function resetPasswordState() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }
    setPasswordLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPasswordLoading(false);
    if (error) {
      setPasswordError(error.message ?? "Could not change password");
      return;
    }
    setPasswordOpen(false);
    resetPasswordState();
  }

  function resetEnrollState() {
    setStep("password");
    setPassword("");
    setTotpUri(null);
    setCode("");
    setError(null);
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: enableError } = await authClient.twoFactor.enable({ password });
    if (enableError) {
      setLoading(false);
      setError(enableError.message ?? "Could not verify password");
      return;
    }
    const { data, error: uriError } = await authClient.twoFactor.getTotpUri({ password });
    setLoading(false);
    if (uriError || !data) {
      setError(uriError?.message ?? "Could not generate QR code");
      return;
    }
    setTotpUri(data.totpURI);
    setStep("verify");
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message ?? "Invalid code");
      return;
    }
    await refetch();
    setOpen(false);
    resetEnrollState();
  }

  async function onDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableError(null);
    setDisableLoading(true);
    const { error: disableErr } = await authClient.twoFactor.disable({
      password: disablePassword,
    });
    setDisableLoading(false);
    if (disableErr) {
      setDisableError(disableErr.message ?? "Could not disable 2FA");
      return;
    }
    await refetch();
    setDisableOpen(false);
    setDisablePassword("");
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <h2 className="text-[13.5px] font-bold">Security</h2>
      <div className="mt-3 flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] font-medium">HTTPS</span>
          <span className="text-[12px] text-success-fg">Enabled</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] font-medium">Password</span>
          <Dialog
            open={passwordOpen}
            onOpenChange={(next) => {
              setPasswordOpen(next);
              if (!next) resetPasswordState();
            }}
          >
            <DialogTrigger
              render={<Button variant="outline" size="sm" className="h-7 px-2.5 text-[12px]" />}
            >
              Change
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>
                  Changing your password signs you out of other devices.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onChangePassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                {passwordError && <p className="text-sm text-critical-fg">{passwordError}</p>}
                <DialogFooter>
                  <Button type="submit" disabled={passwordLoading}>
                    {passwordLoading ? "Changing..." : "Change password"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] font-medium">Role-based access control</span>
          <span className="text-[12px] text-success-fg">Enabled</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px] font-medium">Two-factor authentication</span>
          {twoFactorEnabled ? (
            <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
              <DialogTrigger
                render={<Button variant="outline" size="sm" className="h-7 px-2.5 text-[12px]" />}
              >
                Disable
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Disable two-factor authentication</DialogTitle>
                  <DialogDescription>Confirm your password to continue.</DialogDescription>
                </DialogHeader>
                <form onSubmit={onDisable} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="disable-password">Password</Label>
                    <Input
                      id="disable-password"
                      type="password"
                      value={disablePassword}
                      onChange={(e) => setDisablePassword(e.target.value)}
                      required
                    />
                  </div>
                  {disableError && <p className="text-sm text-critical-fg">{disableError}</p>}
                  <DialogFooter>
                    <Button type="submit" variant="destructive" disabled={disableLoading}>
                      {disableLoading ? "Disabling..." : "Disable 2FA"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) resetEnrollState();
              }}
            >
              <DialogTrigger render={<Button size="sm" className="h-7 px-2.5 text-[12px]" />}>
                Enable
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enable two-factor authentication</DialogTitle>
                  <DialogDescription>
                    {step === "password"
                      ? "Confirm your password to start."
                      : "Scan the QR code with your authenticator app, then enter the code."}
                  </DialogDescription>
                </DialogHeader>
                {step === "password" ? (
                  <form onSubmit={onSubmitPassword} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="enable-password">Password</Label>
                      <Input
                        id="enable-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    {error && <p className="text-sm text-critical-fg">{error}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Verifying..." : "Continue"}
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <form onSubmit={onVerifyCode} className="flex flex-col gap-4">
                    {totpUri && (
                      <div className="flex justify-center rounded-md border border-border p-4">
                        <QRCode value={totpUri} size={160} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="totp-code">6-digit code</Label>
                      <Input
                        id="totp-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        minLength={6}
                        maxLength={6}
                        inputMode="numeric"
                      />
                    </div>
                    {error && <p className="text-sm text-critical-fg">{error}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Verifying..." : "Verify & enable"}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
