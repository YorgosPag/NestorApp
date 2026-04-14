/**
 * usePropertyInlineEdit — Hook that manages inline edit state for properties table.
 *
 * Google SRP: Owns ALL edit state, validation, save, and cancel logic.
 * The parent component only calls startEdit(property) and renders the edit row.
 *
 * @module components/building-management/tabs/usePropertyInlineEdit
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property, PropertyType } from '@/types/property';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';

interface UsePropertyInlineEditReturn {
  editingId: string | null;
  editName: string;
  editType: PropertyType | '';
  editFloor: string;
  editArea: string;
  editStatus: string;
  saving: boolean;
  setEditName: (v: string) => void;
  setEditType: (v: PropertyType | '') => void;
  setEditFloor: (v: string) => void;
  setEditArea: (v: string) => void;
  setEditStatus: (v: string) => void;
  startEdit: (property: Property) => void;
  cancelEdit: () => void;
  handleSaveEdit: () => Promise<void>;
  ImpactDialog: ReactNode;
}

export function usePropertyInlineEdit(onSaved: () => Promise<void>): UsePropertyInlineEditReturn {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { success, error: notifyError } = useNotifications();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<PropertyType | ''>('apartment');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editStatus, setEditStatus] = useState('for-sale');
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const { runExistingPropertyUpdate, ImpactDialog } = useGuardedPropertyMutation(
    editingProperty ? { id: editingProperty.id } : null,
  );

  const startEdit = useCallback((property: Property) => {
    setEditingProperty(property);
    setEditingId(property.id);
    setEditName(property.name || '');
    setEditType(property.type || 'apartment');
    setEditFloor(property.floor ? String(property.floor) : '');
    setEditArea(property.area ? String(property.area) : '');
    setEditStatus(property.status || 'for-sale');
    setEditVersion((property as unknown as { _v?: number })._v);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingProperty(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        type: editType || undefined,
        floor: editFloor ? parseInt(editFloor, 10) : undefined,
        area: editArea ? parseFloat(editArea) : undefined,
        status: editStatus || undefined,
      };
      if (editVersion !== undefined) payload._v = editVersion;

      if (!editingProperty) {
        throw new Error(t('inlineEdit.updateError'));
      }

      const completed = await runExistingPropertyUpdate(editingProperty, payload);
      if (!completed) {
        return;
      }

      success(t('inlineEdit.updated'));
      setEditingId(null);
      setEditingProperty(null);
      await onSaved();
    } catch (err) {
      notifyError(
        translatePropertyMutationError(
          err,
          t,
          'inlineEdit.updateError',
        ),
      );
    } finally {
      setSaving(false);
    }
  }, [
    editArea,
    editFloor,
    editName,
    editStatus,
    editType,
    editVersion,
    editingId,
    editingProperty,
    notifyError,
    onSaved,
    runExistingPropertyUpdate,
    t,
  ]);

  return {
    editingId, editName, editType, editFloor, editArea, editStatus, saving,
    setEditName, setEditType, setEditFloor, setEditArea, setEditStatus,
    startEdit, cancelEdit, handleSaveEdit,
    ImpactDialog,
  };
}
