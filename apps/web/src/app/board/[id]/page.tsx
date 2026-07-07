"use client";

import { useParams } from "next/navigation";
import { BoardView } from "@/features/whiteboard/ui/BoardView";

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  return <BoardView boardId={id} />;
}
