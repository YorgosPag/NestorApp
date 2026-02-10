'use client';

/**
 * @fileoverview Company Setup — Service Presets Section
 * @description Διαχείριση προκαθορισμένων περιγραφών υπηρεσιών (CRUD)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-011 Service Presets
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Plus, Trash2, Download, Pencil, Check, X } from 'lucide-react';
import { VATRateSelector } from '../shared/VATRateSelector';
import { useServicePresets } from '../../hooks';
import type { ServicePreset, MyDataIncomeType } from '../../types';

// ============================================================================
// DEFAULT PRESETS — 10 τυπικές υπηρεσίες μηχανικού
// ============================================================================

function generatePresetId(): string {
  return `sp_${crypto.randomUUID().split('-')[0]}`;
}

function createDefaultPresets(t: (key: string) => string): ServicePreset[] {
  return [
    { presetId: generatePresetId(), description: 'ΠΕΑ — Πιστοποιητικό Ενεργειακής Απόδοσης', unit: t('units.pieces'), unitPrice: 250, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 0 },
    { presetId: generatePresetId(), description: 'Αρχιτεκτονική Μελέτη', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 1 },
    { presetId: generatePresetId(), description: 'Έκδοση Οικοδομικής Άδειας', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 2 },
    { presetId: generatePresetId(), description: 'Τοπογραφικό Διάγραμμα', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 3 },
    { presetId: generatePresetId(), description: 'Επίβλεψη Εργασιών', unit: t('units.hours'), unitPrice: 80, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 4 },
    { presetId: generatePresetId(), description: 'Στατική Μελέτη', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 5 },
    { presetId: generatePresetId(), description: 'Μηχανολογική (Η/Μ) Μελέτη', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 6 },
    { presetId: generatePresetId(), description: 'Ενεργειακή Μελέτη', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 7 },
    { presetId: generatePresetId(), description: 'Τεχνική Συμβουλευτική', unit: t('units.hours'), unitPrice: 60, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 8 },
    { presetId: generatePresetId(), description: 'Ηλεκτρολογική Μελέτη', unit: t('units.pieces'), unitPrice: 0, vatRate: 24, mydataCode: 'category1_3' as MyDataIncomeType, isActive: true, sortOrder: 9 },
  ];
}

// ============================================================================
// NEW PRESET FORM
// ============================================================================

interface NewPresetFormState {
  description: string;
  unit: string;
  unitPrice: string;
  vatRate: number;
}

const INITIAL_FORM: NewPresetFormState = {
  description: '',
  unit: '',
  unitPrice: '0',
  vatRate: 24,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ServicePresetsSection() {
  const { t } = useTranslation('accounting');
  const { presets, loading, saving, error, savePresets } = useServicePresets();

  const [localPresets, setLocalPresets] = useState<ServicePreset[]>([]);
  const [synced, setSynced] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewPresetFormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NewPresetFormState>(INITIAL_FORM);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync remote → local on first load
  if (!synced && !loading && presets.length > 0) {
    setLocalPresets(presets);
    setSynced(true);
  }
  if (!synced && !loading && presets.length === 0) {
    setSynced(true);
  }

  const handleSave = useCallback(async (updatedPresets: ServicePreset[]) => {
    const success = await savePresets(updatedPresets);
    if (success) {
      setLocalPresets(updatedPresets);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  }, [savePresets]);

  const handleAddPreset = useCallback(() => {
    if (!form.description.trim()) return;

    const newPreset: ServicePreset = {
      presetId: generatePresetId(),
      description: form.description.trim(),
      unit: form.unit.trim() || t('units.pieces'),
      unitPrice: parseFloat(form.unitPrice) || 0,
      vatRate: form.vatRate,
      mydataCode: 'category1_3' as MyDataIncomeType,
      isActive: true,
      sortOrder: localPresets.length,
    };

    const updated = [...localPresets, newPreset];
    setLocalPresets(updated);
    setForm(INITIAL_FORM);
    setShowForm(false);
    handleSave(updated);
  }, [form, localPresets, handleSave, t]);

  const handleDeletePreset = useCallback((presetId: string) => {
    const updated = localPresets.filter((p) => p.presetId !== presetId);
    setLocalPresets(updated);
    handleSave(updated);
  }, [localPresets, handleSave]);

  const startEdit = useCallback((preset: ServicePreset) => {
    setEditingId(preset.presetId);
    setEditForm({
      description: preset.description,
      unit: preset.unit,
      unitPrice: String(preset.unitPrice),
      vatRate: preset.vatRate,
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(INITIAL_FORM);
  }, []);

  const confirmEdit = useCallback(() => {
    if (!editingId || !editForm.description.trim()) return;

    const updated = localPresets.map((p) =>
      p.presetId === editingId
        ? {
            ...p,
            description: editForm.description.trim(),
            unit: editForm.unit.trim() || t('units.pieces'),
            unitPrice: parseFloat(editForm.unitPrice) || 0,
            vatRate: editForm.vatRate,
          }
        : p,
    );
    setLocalPresets(updated);
    setEditingId(null);
    setEditForm(INITIAL_FORM);
    handleSave(updated);
  }, [editingId, editForm, localPresets, handleSave, t]);

  const handleLoadDefaults = useCallback(() => {
    const defaults = createDefaultPresets(t);
    setLocalPresets(defaults);
    handleSave(defaults);
  }, [handleSave, t]);

  const formatCurrency = (amount: number) =>
    amount > 0
      ? new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount)
      : t('servicePresets.variablePrice');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="large" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('servicePresets.title')}</CardTitle>
          <div className="flex gap-2">
            {localPresets.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleLoadDefaults} disabled={saving}>
                <Download className="mr-2 h-4 w-4" />
                {t('servicePresets.loadDefaults')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" />
              {t('servicePresets.addPreset')}
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t('servicePresets.description')}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Success / Error messages */}
        {saveSuccess && (
          <div
            role="status"
            className="rounded-md border border-green-500/50 bg-green-500/5 p-3 text-sm text-green-700 dark:text-green-400"
          >
            {t('servicePresets.saveSuccess')}
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {t('servicePresets.saveError')}: {error}
          </div>
        )}

        {/* Add new preset form */}
        {showForm && (
          <>
            <article className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium">{t('servicePresets.newPreset')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <fieldset className="md:col-span-2">
                  <Label>{t('servicePresets.presetDescription')}</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('servicePresets.presetDescriptionPlaceholder')}
                  />
                </fieldset>
                <fieldset>
                  <Label>{t('forms.unit')}</Label>
                  <Input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder={t('units.pieces')}
                  />
                </fieldset>
                <fieldset>
                  <Label>{t('forms.unitPrice')}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.unitPrice}
                    onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                  />
                </fieldset>
              </div>
              <div className="flex items-end gap-3">
                <fieldset>
                  <Label>ΦΠΑ</Label>
                  <VATRateSelector
                    value={form.vatRate}
                    onValueChange={(rate) => setForm((f) => ({ ...f, vatRate: rate }))}
                  />
                </fieldset>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPreset} disabled={!form.description.trim() || saving}>
                    {saving ? <Spinner size="small" className="mr-2" /> : null}
                    {t('forms.save')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                    {t('forms.cancel')}
                  </Button>
                </div>
              </div>
            </article>
            <Separator />
          </>
        )}

        {/* Presets list */}
        {localPresets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('servicePresets.noPresets')}
          </p>
        ) : (
          <ul className="space-y-2">
            {localPresets.map((preset) => (
              <li
                key={preset.presetId}
                className="flex items-center gap-3 border border-border rounded-md px-3 py-2"
              >
                {editingId === preset.presetId ? (
                  /* Inline edit mode */
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                    <fieldset className="md:col-span-2">
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </fieldset>
                    <fieldset>
                      <Input
                        value={editForm.unit}
                        onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                      />
                    </fieldset>
                    <fieldset>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editForm.unitPrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, unitPrice: e.target.value }))}
                      />
                    </fieldset>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={confirmEdit}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cancelEdit}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <span className="flex-1 text-sm font-medium truncate">{preset.description}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{preset.unit}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatCurrency(preset.unitPrice)}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{preset.vatRate}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => startEdit(preset)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => handleDeletePreset(preset.presetId)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Load defaults button (shown when presets exist too, at the bottom) */}
        {localPresets.length > 0 && (
          <footer className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={handleLoadDefaults} disabled={saving}>
              <Download className="mr-2 h-4 w-4" />
              {t('servicePresets.resetDefaults')}
            </Button>
          </footer>
        )}
      </CardContent>
    </Card>
  );
}
