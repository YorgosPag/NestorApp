'use client';

import { useEffect, useRef, useState } from "react";
import { useDebounce } from '@/hooks/useDebounce';

export function useAutosave<T>(data: T, isEditing: boolean, delay = 2000) {
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dirtyRef = useRef(false);

  const startEditing = () => { /* noop: έλεγχος γίνεται από parent */ };
  const stopEditing = () => { /* noop */ };
  const setDirty = () => { dirtyRef.current = true; };

  const debouncedData = useDebounce(data, delay);

  useEffect(() => {
    if (!isEditing || !dirtyRef.current) return;
    setAutoSaving(true);
    const t = setTimeout(() => {
      setAutoSaving(false);
      setLastSaved(new Date());
      dirtyRef.current = false;
    }, 1000);
    return () => clearTimeout(t);
  }, [debouncedData, isEditing]);

  return { autoSaving, lastSaved, startEditing, stopEditing, setDirty };
}
