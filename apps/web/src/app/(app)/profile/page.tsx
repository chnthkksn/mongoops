"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";

const AVATAR_SIZE = 160;

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }
      const scale = Math.max(AVATAR_SIZE / img.width, AVATAR_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (AVATAR_SIZE - w) / 2, (AVATAR_SIZE - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

function ProfileForm({
  user,
  onSaved,
}: {
  user: { name: string; email: string; image?: string | null };
  onSaved: () => Promise<unknown>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user.name);
  const [image, setImage] = useState<string | null>(user.image ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = name !== user.name || image !== (user.image ?? null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setImage(dataUrl);
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process image");
    }
  }

  async function onSave() {
    setError(null);
    setSaved(false);
    setLoading(true);
    const { error: updateError } = await authClient.updateUser({ name, image });
    setLoading(false);
    if (updateError) {
      setError(updateError.message ?? "Could not update profile");
      return;
    }
    await onSaved();
    setSaved(true);
  }

  return (
    <div className="rounded-[10px] border border-border bg-card p-[18px]">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-bg text-xl font-semibold text-neutral-fg"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            (name || user.name)?.[0]?.toUpperCase() ?? "?"
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Change
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickFile}
        />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{name}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Label htmlFor="profile-name">Name</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="max-w-sm"
        />
      </div>

      {error && <p className="mt-3 text-sm text-critical-fg">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-success-fg">Profile updated.</p>}

      <div className="mt-4">
        <Button onClick={onSave} disabled={!dirty || loading}>
          {loading ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, refetch } = useSession();

  return (
    <AppShell title="Profile">
      {session?.user ? (
        <ProfileForm user={session.user} onSaved={refetch} />
      ) : (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
    </AppShell>
  );
}
