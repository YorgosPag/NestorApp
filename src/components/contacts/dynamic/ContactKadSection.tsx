'use client';

/**
 * ============================================================================
 * ContactKadSection — Multi-KAD Activities Section for Company Contacts
 * ============================================================================
 *
 * Supports multiple ΚΑΔ codes: one primary (always present) + N secondary.
 * Pattern inspired by accounting KadSection.tsx (ADR-ACC-013).
 *
 * Reuses:
 * - KadCodePicker (ο ΕΝΑΣ επιλογέας ΚΑΔ 2025 — δέσμευση μόνο με επιλογή/ακριβή κωδικό, ποτέ ανά πάτημα)
 * - KadBulkPaste («Επικόλληση λίστας ΓΕΜΗ» για δευτερεύοντες)
 * - Radix UI components (Button, Input, Separator)
 *
 * @module components/contacts/dynamic/ContactKadSection
 */

import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { KadCodePicker } from '@/components/shared/KadCodePicker';
import { KadBulkPaste } from '@/components/contacts/dynamic/KadBulkPaste';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import type { KadActivity } from '@/types/ContactFormTypes';
import type { KadSelection } from '@/lib/kad/kad-types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useNotifications } from '@/providers/NotificationProvider';
import { cn } from '@/lib/utils';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// TYPES
// ============================================================================

interface ContactKadSectionProps {
  activities: KadActivity[];
  chamber: string;
  disabled?: boolean;
  onChange: (updates: { activities: KadActivity[]; chamber: string }) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptySecondary(): KadActivity {
  return {
    code: '',
    description: '',
    type: 'secondary',
    activeFrom: nowISO().split('T')[0],
  };
}

/** Η επιλογή του καταλόγου πάνω σε υπάρχουσα γραμμή· `null` = καθαρισμός (χωρίς σημαία καταλόγου). */
function applySelection(activity: KadActivity, selection: KadSelection | null): KadActivity {
  const base: KadActivity = {
    code: '',
    description: '',
    type: activity.type,
    ...(activity.activeFrom ? { activeFrom: activity.activeFrom } : {}),
  };
  return selection === null ? base : { ...base, ...selection };
}

/** Ίδια τιμή = ίδιος κωδικός, ίδια περιγραφή ΚΑΙ ίδιος κατάλογος (αλλιώς η αναβάθμιση ΚΑΔ 2008 → 2025 θα χανόταν). */
function isSameSelection(activity: KadActivity, selection: KadSelection): boolean {
  return (
    activity.code.trim() === selection.code &&
    activity.description === selection.description &&
    activity.catalog === selection.catalog
  );
}

function hasDuplicateCode(
  primaryCode: string,
  secondaries: KadActivity[],
  nextCode: string,
  excludedSecondaryIndex?: number,
): boolean {
  if (!nextCode) {
    return false;
  }

  if (primaryCode === nextCode) {
    return true;
  }

  return secondaries.some((activity, index) => {
    if (excludedSecondaryIndex !== undefined && index === excludedSecondaryIndex) {
      return false;
    }
    return activity.code.trim() === nextCode;
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContactKadSection({
  activities,
  chamber,
  disabled = false,
  onChange,
}: ContactKadSectionProps) {
  const { t } = useTranslation('forms');
  const primaryHeadingId = useId();
  const colors = useSemanticColors();
  const { success, info, warning, showConfirmDialog } = useNotifications();
  const [bulkOpen, setBulkOpen] = useState(false);

  // Derive primary from array (first 'primary', or first entry, or empty)
  const primary: KadActivity = activities.find((a) => a.type === 'primary') ?? {
    code: '',
    description: '',
    type: 'primary',
  };
  const secondaries = activities.filter((a) => a.type === 'secondary');

  // Rebuild full array from primary + secondaries
  const rebuildActivities = useCallback(
    (newPrimary: KadActivity, newSecondaries: KadActivity[]) => [newPrimary, ...newSecondaries],
    [],
  );

  /** Επιβεβαίωση αλλαγής κύριου ΚΑΔ — ανοίγει ΜΙΑ φορά ανά πραγματική αλλαγή (ο επιλογέας δεν εκπέμπει ανά πάτημα). */
  const confirmPrimaryChange = useCallback(
    (oldCode: string, newCode: string) =>
      showConfirmDialog(
        t('kad.confirmPrimaryChange.message', { oldCode, newCode }),
        () => undefined,
        undefined,
        {
          title: t('kad.confirmPrimaryChange.title'),
          confirmText: t('kad.confirmPrimaryChange.confirm'),
          cancelText: t('kad.confirmPrimaryChange.cancel'),
          type: 'warning',
        },
      ),
    [showConfirmDialog, t],
  );

  const handlePrimaryChange = useCallback(
    async (selection: KadSelection | null) => {
      if (selection === null) {
        warning(t('kad.notifications.primaryRequired'));
        return;
      }
      const nextCode = selection.code;
      const previousCode = primary.code.trim();
      if (hasDuplicateCode('', secondaries, nextCode)) {
        warning(t('kad.notifications.duplicateCode', { code: nextCode }));
        return;
      }
      if (isSameSelection(primary, selection)) return;
      const codeChanged = previousCode !== nextCode;
      if (previousCode && codeChanged && !(await confirmPrimaryChange(previousCode, nextCode))) return;

      onChange({ activities: rebuildActivities(applySelection(primary, selection), secondaries), chamber });
      success(t(previousCode ? 'kad.notifications.primaryUpdated' : 'kad.notifications.primarySet', { code: nextCode }));
      if (codeChanged) info(t('kad.notifications.primaryImpact'));
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, confirmPrimaryChange, success, info, warning, t],
  );

  const handleSecondaryChange = useCallback(
    (index: number, selection: KadSelection | null) => {
      const existing = secondaries[index];
      if (!existing) return;
      const previousCode = existing.code.trim();
      const nextCode = selection?.code ?? '';
      if (selection !== null && isSameSelection(existing, selection)) return;
      if (hasDuplicateCode(primary.code.trim(), secondaries, nextCode, index)) {
        warning(t('kad.notifications.duplicateCode', { code: nextCode }));
        return;
      }

      const updated = [...secondaries];
      updated[index] = applySelection(existing, selection);
      onChange({ activities: rebuildActivities(primary, updated), chamber });

      if (!previousCode && nextCode) {
        success(t('kad.notifications.secondaryAdded', { code: nextCode }));
      } else if (previousCode && nextCode && previousCode !== nextCode) {
        info(t('kad.notifications.secondaryUpdated', { oldCode: previousCode, newCode: nextCode }));
      }
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, success, info, warning, t],
  );

  /** «Επικόλληση λίστας ΓΕΜΗ»: οι κενές γραμμές φεύγουν, οι νέοι ΚΑΔ μπαίνουν στο τέλος. */
  const handleBulkAdd = useCallback(
    (selections: KadSelection[]) => {
      const activeFrom = nowISO().split('T')[0];
      const kept = secondaries.filter((activity) => activity.code.trim() !== '');
      const added = selections.map((selection): KadActivity => ({ ...selection, type: 'secondary', activeFrom }));
      onChange({ activities: rebuildActivities(primary, [...kept, ...added]), chamber });
      setBulkOpen(false);
      success(t('kad.bulk.added', { count: added.length }));
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, success, t],
  );

  const addSecondary = useCallback(() => {
    const hasBlankSecondary = secondaries.some((activity) => activity.code.trim().length === 0);
    if (hasBlankSecondary) {
      warning(t('kad.notifications.completeExistingSecondary'));
      return;
    }

    onChange({
      activities: rebuildActivities(primary, [...secondaries, createEmptySecondary()]),
      chamber,
    });
    info(t('kad.notifications.secondaryRowAdded'));
  }, [primary, secondaries, chamber, onChange, rebuildActivities, info, warning, t]);

  const removeSecondary = useCallback(
    async (index: number) => {
      const target = secondaries[index];
      if (!target) {
        return;
      }

      const code = target.code.trim();
      if (code) {
        const confirmed = await showConfirmDialog(
          t('kad.confirmRemove.message', { code }),
          () => undefined,
          undefined,
          {
            title: t('kad.confirmRemove.title'),
            confirmText: t('kad.confirmRemove.confirm'),
            cancelText: t('kad.confirmRemove.cancel'),
            type: 'warning',
          },
        );

        if (!confirmed) {
          return;
        }
      }

      const updated = secondaries.filter((_, currentIndex) => currentIndex !== index);
      onChange({ activities: rebuildActivities(primary, updated), chamber });

      if (code) {
        success(t('kad.notifications.secondaryRemoved', { code }));
      }
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, showConfirmDialog, success, t],
  );

  const handleChamberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ activities, chamber: e.target.value });
    },
    [activities, onChange],
  );

  return (
    <fieldset className="space-y-6" disabled={disabled}>
      {/* Primary KAD — η κεφαλίδα ονομάζει ΚΑΙ την ενότητα ΚΑΙ το πεδίο (ADR-598 G11) */}
      <section aria-labelledby={primaryHeadingId}>
        <h3 id={primaryHeadingId} className="text-sm font-semibold text-foreground mb-3">
          {t('kad.primaryActivity')}
        </h3>
        <KadCodePicker
          aria-labelledby={primaryHeadingId}
          value={primary.code}
          catalog={primary.catalog}
          disabled={disabled}
          onChange={(selection) => void handlePrimaryChange(selection)}
        />
        {primary.description && (
          <p className={cn('mt-1 text-sm', colors.text.muted)}>{primary.description}</p>
        )}
      </section>

      <Separator />

      {/* Secondary KADs */}
      <section aria-label={t('kad.secondaryActivities')}>
        <header className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('kad.secondaryActivities')}
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkOpen((open) => !open)}
              disabled={disabled}
              aria-expanded={bulkOpen}
            >
              <ClipboardPaste className="mr-1 h-4 w-4" />
              {t('kad.bulk.open')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSecondary}
              disabled={disabled}
            >
              <Plus className="mr-1 h-4 w-4" />
              {t('kad.addActivity')}
            </Button>
          </div>
        </header>

        {bulkOpen && !disabled && (
          <KadBulkPaste
            primaryCode={primary.code}
            secondaryCodes={secondaries.map((activity) => activity.code)}
            onConfirm={handleBulkAdd}
            onCancel={() => setBulkOpen(false)}
          />
        )}

        {secondaries.length === 0 ? (
          <p className={cn('text-sm py-2 text-center', colors.text.muted)}>
            {t('kad.noSecondaryActivities')}
          </p>
        ) : (
          <ul className="space-y-2">
            {secondaries.map((kad, index) => (
              <li key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-start">
                <div className="space-y-1">
                  <KadCodePicker
                    aria-label={t('kad.secondaryActivityItem', { position: index + 1 })}
                    value={kad.code}
                    catalog={kad.catalog}
                    disabled={disabled}
                    onChange={(selection) => handleSecondaryChange(index, selection)}
                  />
                  {kad.description && (
                    <p className={cn('text-sm', colors.text.muted)}>{kad.description}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void removeSecondary(index)}
                  disabled={disabled}
                  aria-label={t('kad.removeActivity')}
                  className="text-destructive hover:text-destructive mt-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      {/* Chamber field */}
      <section aria-label={t('kad.chamber')}>
        <Label htmlFor="chamber">{t('kad.chamber')}</Label>
        <Input
          id="chamber"
          name="chamber"
          value={chamber}
          onChange={handleChamberChange}
          disabled={disabled}
          className="mt-1"
        />
      </section>
    </fieldset>
  );
}

export default ContactKadSection;
