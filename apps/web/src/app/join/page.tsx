"use client";

import { Suspense } from "react";
import { JoinView } from "@/features/whiteboard/ui/JoinView";

export default function JoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Загрузка…</div>}>
      <JoinView />
    </Suspense>
  );
}
