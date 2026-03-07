'use client';

/**
 * EntityLinkCard — Centralized entity linking component
 *
 * Generic card for linking entities (company, project, building).
 * Used in: Building details, Unit details, Project details.
 *
 * @module components/shared/EntityLinkCard
 * @see CompanySelectorCard (building) — original pattern
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface EntityLinkOption {
  id: string;
  name: string;
}

export interface EntityLinkLabels {
  title: string;
  label: string;
  placeholder: string;
  noSelection: string;
  loading: string;
  save: string;
  saving: string;
  success: string;
  error: string;
  currentLabel: string;
}

export interface EntityLinkCardProps {
  /** Unique ID for accessibility */
  cardId: string;
  /** Icon for the card header */
  icon: LucideIcon;
  /** All UI labels (pre-translated by caller) */
  labels: EntityLinkLabels;
  /** Current linked entity ID */
  currentValue?: string;
  /** Load available options */
  loadOptions: () => Promise<EntityLinkOption[]>;
  /** Save the selected value (null = unlink) */
  onSave: (newId: string | null, name: string) => Promise<{ success: boolean; error?: string }>;
  /** Callback after successful save */
  onChanged?: (newId: string, name: string) => void;
  /** Edit mode toggle */
  isEditing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

const NONE_VALUE = '__none__';
const STATUS_RESET_MS = 3000;

export function EntityLinkCard({
  cardId,
  icon: Icon,
  labels,
  currentValue,
  loadOptions,
  onSave,
  onChanged,
  isEditing = true,
}: EntityLinkCardProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();

  const [options, setOptions] = useState<EntityLinkOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentValue || NONE_VALUE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load options on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await loadOptions();
        if (!cancelled) setOptions(data);
      } catch {
        // Options load failure is non-fatal — empty list shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [loadOptions]);

  // Sync with external value changes
  useEffect(() => {
    if (currentValue !== undefined) {
      setSelectedId(currentValue || NONE_VALUE);
    }
  }, [currentValue]);

  const handleChange = useCallback((value: string) => {
    setSelectedId(value);
    setSaveStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStatus('idle');

    try {
      const idToSave = selectedId === NONE_VALUE ? null : selectedId;
      const selectedOption = options.find(o => o.id === selectedId);
      const name = selectedOption?.name || '';

      const result = await onSave(idToSave, name);

      if (result.success) {
        setSaveStatus('success');
        if (onChanged && idToSave) {
          onChanged(idToSave, name);
        }
        setTimeout(() => setSaveStatus('idle'), STATUS_RESET_MS);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [selectedId, options, onSave, onChanged]);

  const hasChanges = selectedId !== (currentValue || NONE_VALUE);
  const currentName = options.find(o => o.id === currentValue)?.name;

  return (
    <Card>
      <CardHeader className="p-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <Icon className={iconSizes.md} />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2">
        <fieldset className="space-y-2">
          <Label htmlFor={cardId}>{labels.label}</Label>

          {loading ? (
            <section className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{labels.loading}</span>
            </section>
          ) : (
            <Select
              value={selectedId}
              onValueChange={handleChange}
              disabled={!isEditing}
            >
              <SelectTrigger
                id={cardId}
                className={cn(
                  !isEditing && 'bg-muted',
                  saveStatus === 'success' && getStatusBorder('success'),
                  saveStatus === 'error' && getStatusBorder('error')
                )}
              >
                <SelectValue placeholder={labels.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {labels.noSelection}
                </SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        {!isEditing && currentName && (
          <p className={cn('text-sm', colors.text.muted)}>
            {labels.currentLabel} <strong>{currentName}</strong>
          </p>
        )}

        {isEditing && (
          <footer className="flex items-center justify-between pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              variant={hasChanges ? 'default' : 'outline'}
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className={cn(iconSizes.sm, 'mr-2 animate-spin')} />
                  {labels.saving}
                </>
              ) : (
                <>
                  <Save className={cn(iconSizes.sm, 'mr-2')} />
                  {labels.save}
                </>
              )}
            </Button>

            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className={iconSizes.sm} />
                {labels.success}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className={iconSizes.sm} />
                {labels.error}
              </span>
            )}
          </footer>
        )}
      </CardContent>
    </Card>
  );
}
