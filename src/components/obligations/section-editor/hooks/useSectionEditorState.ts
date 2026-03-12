"use client";

import { useState, useCallback } from "react";
import type { ObligationSection } from "@/types/obligations";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

export function useSectionEditorState(
  initial: ObligationSection,
  onSave: (s: ObligationSection) => void,
  onCancel?: () => void
) {
  const { t } = useTranslation("obligations");
  const { confirm, dialogProps } = useConfirmDialog();
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

  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmLeave = await confirm({
        title: t("sectionEditor.confirmLeaveTitle"),
        description: t("sectionEditor.confirmLeave"),
        variant: 'warning',
        confirmText: t("sectionEditor.confirmLeaveConfirm"),
        cancelText: t("sectionEditor.confirmLeaveCancel"),
      });
      if (!confirmLeave) return;
    }
    setEditedSection(initial);
    setHasUnsavedChanges(false);
    onCancel?.();
  }, [hasUnsavedChanges, initial, onCancel, t, confirm]);

  return { editedSection, hasUnsavedChanges, updateSection, handleSave, handleCancel, confirmDialogProps: dialogProps };
}
