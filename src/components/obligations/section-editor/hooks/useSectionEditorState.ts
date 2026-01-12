"use client";

import { useState, useCallback } from "react";
import type { ObligationSection } from "@/types/obligations";

export function useSectionEditorState(
  initial: ObligationSection,
  onSave: (s: ObligationSection) => void,
  onCancel?: () => void
) {
  const [editedSection, setEditedSection] = useState<ObligationSection>(initial);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateSection = useCallback((field: keyof ObligationSection, value: unknown) => {
    // 🏢 ENTERPRISE: Type-safe section update using ObligationSection field type
    setEditedSection(prev => ({ ...prev, [field]: value as ObligationSection[typeof field] }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(editedSection);
    setHasUnsavedChanges(false);
  }, [editedSection, onSave]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm("Έχετε μη αποθηκευμένες αλλαγές. Θέλετε να συνεχίσετε χωρίς αποθήκευση;");
      if (!confirmLeave) return;
    }
    setEditedSection(initial);
    setHasUnsavedChanges(false);
    onCancel?.();
  }, [hasUnsavedChanges, initial, onCancel]);

  return { editedSection, hasUnsavedChanges, updateSection, handleSave, handleCancel };
}
