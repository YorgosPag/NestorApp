/**
 * useUnitInlineEdit — Hook that manages inline edit state for units table.
 *
 * Google SRP: Owns ALL edit state, validation, save, and cancel logic.
 * The parent component only calls startEdit(unit) and renders the edit row.
 *
 * @module components/building-management/tabs/useUnitInlineEdit
 */

import { useState, useCallback } from 'react';
import { apiClient, ApiClientError } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Unit, UnitType } from '@/types/unit';

interface UseUnitInlineEditReturn {
  editingId: string | null;
  editName: string;
  editType: UnitType | '';
  editFloor: string;
  editArea: string;
  editStatus: string;
  saving: boolean;
  setEditName: (v: string) => void;
  setEditType: (v: UnitType | '') => void;
  setEditFloor: (v: string) => void;
  setEditArea: (v: string) => void;
  setEditStatus: (v: string) => void;
  startEdit: (unit: Unit) => void;
  cancelEdit: () => void;
  handleSaveEdit: () => Promise<void>;
}

export function useUnitInlineEdit(onSaved: () => Promise<void>): UseUnitInlineEditReturn {
  const { t } = useTranslation('units');
  const { success, error: notifyError } = useNotifications();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<UnitType | ''>('apartment');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editStatus, setEditStatus] = useState('for-sale');
  const [editVersion, setEditVersion] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const startEdit = useCallback((unit: Unit) => {
    setEditingId(unit.id);
    setEditName(unit.name || '');
    setEditType(unit.type || 'apartment');
    setEditFloor(unit.floor ? String(unit.floor) : '');
    setEditArea(unit.area ? String(unit.area) : '');
    setEditStatus(unit.status || 'for-sale');
    setEditVersion((unit as unknown as { _v?: number })._v);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
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

      await apiClient.patch(API_ROUTES.UNITS.BY_ID(editingId), payload);
      success(t('inlineEdit.updated'));
      setEditingId(null);
      await onSaved();
    } catch (err) {
      if (ApiClientError.isApiClientError(err) && err.statusCode === 409) {
        notifyError(t('inlineEdit.versionConflict'));
        setEditingId(null);
        await onSaved();
        return;
      }
      notifyError(err instanceof Error ? err.message : t('inlineEdit.updateError'));
    } finally {
      setSaving(false);
    }
  }, [editingId, editName, editType, editFloor, editArea, editStatus, editVersion, onSaved]);

  return {
    editingId, editName, editType, editFloor, editArea, editStatus, saving,
    setEditName, setEditType, setEditFloor, setEditArea, setEditStatus,
    startEdit, cancelEdit, handleSaveEdit,
  };
}
