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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { KadCodePicker } from '@/components/shared/KadCodePicker';
import { Plus, Trash2 } from 'lucide-react';
import type { KadActivity } from '@/types/ContactFormTypes';

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
    (val: { code: string; description: string }) => {
      const updated = { ...primary, code: val.code, description: val.description };
      onChange({ activities: rebuildActivities(updated, secondaries), chamber });
    },
    [primary, secondaries, chamber, onChange, rebuildActivities],
  );

  const handleSecondaryChange = useCallback(
    (index: number, val: { code: string; description: string }) => {
      const updated = [...secondaries];
      updated[index] = { ...updated[index], code: val.code, description: val.description };
      onChange({ activities: rebuildActivities(primary, updated), chamber });
    },
    [primary, secondaries, chamber, onChange, rebuildActivities],
  );

  const addSecondary = useCallback(() => {
    onChange({
      activities: rebuildActivities(primary, [...secondaries, createEmptySecondary()]),
      chamber,
    });
  }, [primary, secondaries, chamber, onChange, rebuildActivities]);

  const removeSecondary = useCallback(
    (index: number) => {
      const updated = secondaries.filter((_, i) => i !== index);
      onChange({ activities: rebuildActivities(primary, updated), chamber });
    },
    [primary, secondaries, chamber, onChange, rebuildActivities],
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
          <p className="mt-1 text-sm text-muted-foreground">{primary.description}</p>
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
          <p className="text-sm text-muted-foreground py-4 text-center">
            {t('kad.noSecondaryActivities')}
          </p>
        ) : (
          <ul className="space-y-3">
            {secondaries.map((kad, index) => (
              <li key={index} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                <div className="space-y-1">
                  <KadCodePicker
                    value={kad.code}
                    description={kad.description}
                    disabled={disabled}
                    onChange={(val) => handleSecondaryChange(index, val)}
                  />
                  {kad.description && (
                    <p className="text-sm text-muted-foreground">{kad.description}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSecondary(index)}
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
