/**
 * useTrashView — Generic trash/active toggle hook
 *
 * Filters items into active (status != 'deleted') and trashed (status == 'deleted').
 * Provides toggle, count, selection.
 *
 * @module hooks/useTrashView
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

"use client";

import { useMemo, useState, useCallback } from "react";

interface TrashableItem {
  id: string;
  status?: string;
  [key: string]: unknown;
}

interface UseTrashViewReturn<T extends TrashableItem> {
  showTrash: boolean;
  toggleTrash: () => void;
  setShowTrash: (show: boolean) => void;
  activeItems: T[];
  trashedItems: T[];
  trashCount: number;
  /** Currently visible items (based on showTrash) */
  visibleItems: T[];
}

export function useTrashView<T extends TrashableItem>(
  items: T[],
): UseTrashViewReturn<T> {
  const [showTrash, setShowTrash] = useState(false);

  const toggleTrash = useCallback(() => setShowTrash((prev) => !prev), []);

  const activeItems = useMemo(
    () => items.filter((item) => item.status !== "deleted"),
    [items],
  );

  const trashedItems = useMemo(
    () => items.filter((item) => item.status === "deleted"),
    [items],
  );

  const trashCount = trashedItems.length;

  const visibleItems = showTrash ? trashedItems : activeItems;

  return {
    showTrash,
    toggleTrash,
    setShowTrash,
    activeItems,
    trashedItems,
    trashCount,
    visibleItems,
  };
}
