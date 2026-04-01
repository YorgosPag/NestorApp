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
 * - KadCodePicker (searchable dropdown, 10.521 entries)
 * - Radix UI components (Button, Input, Separator)
 *
 * @module components/contacts/dynamic/ContactKadSection
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { KadCodePicker } from '@/components/shared/KadCodePicker';
import { Plus, Trash2 } from 'lucide-react';
import type { KadActivity } from '@/types/ContactFormTypes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useNotifications } from '@/providers/NotificationProvider';
import { cn } from '@/lib/utils';

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
    activeFrom: new Date().toISOString().split('T')[0],
  };
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
  const colors = useSemanticColors();
  const { success, info, warning, showConfirmDialog } = useNotifications();

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

  const handlePrimaryChange = useCallback(
    async (val: { code: string; description: string }) => {
      const nextCode = val.code.trim();
      const previousCode = primary.code.trim();

      if (!nextCode) {
        warning(t('kad.notifications.primaryRequired'));
        return;
      }

      if (previousCode === nextCode && primary.description === val.description) {
        return;
      }

      if (previousCode && previousCode !== nextCode) {
        const confirmed = await showConfirmDialog(
          t('kad.confirmPrimaryChange.message', {
            oldCode: previousCode,
            newCode: nextCode,
          }),
          () => undefined,
          undefined,
          {
            title: t('kad.confirmPrimaryChange.title'),
            confirmText: t('kad.confirmPrimaryChange.confirm'),
            cancelText: t('kad.confirmPrimaryChange.cancel'),
            type: 'warning',
          },
        );

        if (!confirmed) {
          return;
        }
      }

      const updated = { ...primary, code: val.code, description: val.description };
      onChange({ activities: rebuildActivities(updated, secondaries), chamber });

      success(
        t(
          previousCode
            ? 'kad.notifications.primaryUpdated'
            : 'kad.notifications.primarySet',
          { code: nextCode },
        ),
      );

      if (!previousCode || previousCode !== nextCode) {
        info(t('kad.notifications.primaryImpact'));
      }
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, showConfirmDialog, success, info, warning, t],
  );

  const handleSecondaryChange = useCallback(
    (index: number, val: { code: string; description: string }) => {
      const existing = secondaries[index];
      if (!existing) {
        return;
      }

      const previousCode = existing.code.trim();
      const nextCode = val.code.trim();
      if (previousCode === nextCode && existing.description === val.description) {
        return;
      }

      const updated = [...secondaries];
      updated[index] = { ...updated[index], code: val.code, description: val.description };
      onChange({ activities: rebuildActivities(primary, updated), chamber });

      if (!previousCode && nextCode) {
        success(t('kad.notifications.secondaryAdded', { code: nextCode }));
        return;
      }

      if (previousCode && nextCode && previousCode !== nextCode) {
        info(
          t('kad.notifications.secondaryUpdated', {
            oldCode: previousCode,
            newCode: nextCode,
          }),
        );
      }
    },
    [primary, secondaries, chamber, onChange, rebuildActivities, success, info, t],
  );

  const addSecondary = useCallback(() => {
    onChange({
      activities: rebuildActivities(primary, [...secondaries, createEmptySecondary()]),
      chamber,
    });
    info(t('kad.notifications.secondaryRowAdded'));
  }, [primary, secondaries, chamber, onChange, rebuildActivities, info, t]);

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
      {/* Primary KAD */}
      <section aria-label={t('kad.primaryActivity')}>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t('kad.primaryActivity')}
        </h3>
        <KadCodePicker
          value={primary.code}
          description={primary.description}
          disabled={disabled}
          onChange={handlePrimaryChange}
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
        </header>

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
                    value={kad.code}
                    description={kad.description}
                    disabled={disabled}
                    onChange={(val) => void handleSecondaryChange(index, val)}
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
