"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyDocumentButton({ raw }: { raw: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={onCopy}
      title="Copy raw document"
      className="rounded-[4px] p-1.5 text-muted-foreground hover:bg-neutral-bg hover:text-foreground"
    >
      {copied ? <Check size={14} className="text-success-fg" /> : <Copy size={14} />}
    </button>
  );
}
