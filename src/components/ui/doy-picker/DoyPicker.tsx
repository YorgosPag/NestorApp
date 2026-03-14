'use client';

/**
 * @fileoverview Κεντρικοποιημένος DoyPicker — Searchable Δ.Ο.Υ. dropdown
 * @description Reusable component για επιλογή Δημόσιας Οικονομικής Υπηρεσίας (ΔΟΥ).
 *   Χρησιμοποιεί τα κεντρικοποιημένα δεδομένα GREEK_TAX_OFFICES και το SearchableCombobox.
 *   Υποστηρίζει: αναζήτηση με κωδικό ή κείμενο, dropdown, add-new capability.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-14
 * @version 1.0.0
 * @see ADR-ACC-013 Searchable ΔΟΥ + ΚΑΔ Dropdowns
 * @compliance CLAUDE.md — Κεντρικοποίηση, Radix (ADR-001), zero any, semantic HTML
 */

import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { SearchableCombobox, type ComboboxOption } from '@/components/ui/searchable-combobox';
import { GREEK_TAX_OFFICES, type TaxOffice } from '@/subapps/accounting/data/greek-tax-offices';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form/FormComponents';

// ============================================================================
// TYPES
// ============================================================================

export interface DoyPickerProps {
  /** Current value (tax office code or free text) */
  value: string;
  /** Callback on value change */
  onValueChange: (value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
  /** Translation namespace override (default: 'common') */
  translationNamespace?: string;
  /** Show add-new button (default: true) */
  showAddNew?: boolean;
}

interface NewDoyFormState {
  code: string;
  name: string;
  region: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DoyPicker({
  value,
  onValueChange,
  disabled = false,
  error,
  className,
  showAddNew = true,
}: DoyPickerProps) {
  const { t } = useTranslation('common');

  // State for add-new dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customOffices, setCustomOffices] = useState<TaxOffice[]>([]);
  const [newDoy, setNewDoy] = useState<NewDoyFormState>({ code: '', name: '', region: '' });

  // Merge standard + custom offices into combobox options
  const options: ComboboxOption[] = useMemo(() => {
    const allOffices = [...GREEK_TAX_OFFICES, ...customOffices];
    return allOffices.map((office) => ({
      value: office.code,
      label: office.name,
      secondaryLabel: `${office.code} · ${office.region}`,
    }));
  }, [customOffices]);

  // Handle add-new submission
  const handleAddNew = useCallback(() => {
    if (!newDoy.code.trim() || !newDoy.name.trim()) return;

    const newOffice: TaxOffice = {
      code: newDoy.code.trim(),
      name: newDoy.name.trim(),
      region: newDoy.region.trim() || t('doyPicker.customRegion', { defaultValue: 'Προσαρμοσμένη' }),
    };

    setCustomOffices((prev) => [...prev, newOffice]);
    onValueChange(newOffice.code);
    setAddDialogOpen(false);
    setNewDoy({ code: '', name: '', region: '' });
  }, [newDoy, onValueChange, t]);

  return (
    <div className={className}>
      <SearchableCombobox
        value={value}
        onValueChange={(val) => onValueChange(val)}
        options={options}
        placeholder={t('doyPicker.search', { defaultValue: 'Αναζήτηση Δ.Ο.Υ...' })}
        emptyMessage={
          showAddNew
            ? t('doyPicker.notFound', { defaultValue: 'Δεν βρέθηκε Δ.Ο.Υ. — προσθέστε νέα' })
            : t('doyPicker.notFoundSimple', { defaultValue: 'Δεν βρέθηκε Δ.Ο.Υ.' })
        }
        allowFreeText
        disabled={disabled}
        error={error}
      />

      {showAddNew && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAddDialogOpen(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          {t('doyPicker.addNew', { defaultValue: 'Προσθήκη νέας Δ.Ο.Υ.' })}
        </Button>
      )}

      {/* Add New DOY Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('doyPicker.addNewTitle', { defaultValue: 'Προσθήκη νέας Δ.Ο.Υ.' })}
            </DialogTitle>
          </DialogHeader>

          <fieldset className="space-y-4">
            <FormField
              label={t('doyPicker.codeLabel', { defaultValue: 'Κωδικός (4ψήφιος)' })}
              htmlFor="new-doy-code"
              required
            >
              <Input
                id="new-doy-code"
                value={newDoy.code}
                onChange={(e) => setNewDoy((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="π.χ. 1101"
                maxLength={4}
              />
            </FormField>

            <FormField
              label={t('doyPicker.nameLabel', { defaultValue: 'Ονομασία' })}
              htmlFor="new-doy-name"
              required
            >
              <Input
                id="new-doy-name"
                value={newDoy.name}
                onChange={(e) => setNewDoy((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('doyPicker.namePlaceholder', { defaultValue: 'π.χ. Α\' Αθηνών' })}
              />
            </FormField>

            <FormField
              label={t('doyPicker.regionLabel', { defaultValue: 'Περιφέρεια' })}
              htmlFor="new-doy-region"
            >
              <Input
                id="new-doy-region"
                value={newDoy.region}
                onChange={(e) => setNewDoy((prev) => ({ ...prev, region: e.target.value }))}
                placeholder={t('doyPicker.regionPlaceholder', { defaultValue: 'π.χ. Αττική' })}
              />
            </FormField>
          </fieldset>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              {t('actions.cancel', { defaultValue: 'Ακύρωση' })}
            </Button>
            <Button
              type="button"
              onClick={handleAddNew}
              disabled={!newDoy.code.trim() || !newDoy.name.trim()}
            >
              {t('actions.add', { defaultValue: 'Προσθήκη' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
