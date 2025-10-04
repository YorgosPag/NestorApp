'use client';

import { useEffect, useRef, useState } from "react";

export function useAutosave<T>(data: T, isEditing: boolean, delay = 2000) {
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dirtyRef = useRef(false);

  const startEditing = () => { /* noop: έλεγχος γίνεται από parent */ };
  const stopEditing = () => { /* noop */ };
  const setDirty = () => { dirtyRef.current = true; };

  useEffect(() => {
    if (!isEditing) return;
    const t = setTimeout(() => {
      if (!dirtyRef.current) return;
      setAutoSaving(true);
      setTimeout(() => {
        setAutoSaving(false);
        setLastSaved(new Date());
        dirtyRef.current = false;
      }, 1000);
    }, delay);
    return () => clearTimeout(t);
  }, [data, isEditing, delay]);

  return { autoSaving, lastSaved, startEditing, stopEditing, setDirty };
}
