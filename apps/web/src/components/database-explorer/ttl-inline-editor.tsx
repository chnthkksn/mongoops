"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

export function TtlInlineEditor({
  clusterId,
  db,
  coll,
  indexName,
  currentValue,
  onSaved,
}: {
  clusterId: string;
  db: string;
  coll: string;
  indexName: string;
  currentValue: number;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(String(currentValue));
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      await api.updateIndexTtl(clusterId, db, coll, indexName, Number(value));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-24 text-xs"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
        disabled={saving || Number(value) === currentValue}
        onClick={onSave}
      >
        {saving ? "..." : "Save"}
      </Button>
    </div>
  );
}
