'use client';

/**
 * ADR-336 — Relationship type picker.
 *
 * Two modes:
 *   1. STATIC — dropdown over the 31 code-level RelationshipType values
 *      (i18n-labeled). Most users stay here.
 *   2. CUSTOM — user typed a new label. Reverse-direction label is collapsed
 *      under «προχωρημένα ▾» (Q4): the AI inference fills it on commit when
 *      the user doesn't override.
 *
 * The picker emits a `RelationshipTypeChoice` discriminated union that maps
 * 1:1 to the server-side `commit-signatory` request body.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getRelationshipTypeOptions } from '@/components/contacts/relationships/config/relationship-form-presets';
import type { ContactType } from '@/types/contacts/contracts';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
import type { RelationshipTypeChoice } from './types';

const CUSTOM_SENTINEL = '__custom__';

interface RelationshipTypePickerProps {
  value: RelationshipTypeChoice | null;
  onChange: (next: RelationshipTypeChoice | null) => void;
  disabled?: boolean;
  /**
   * Τύπος επαφής του ΠΡΟΜΗΘΕΥΤΗ — η πηγή της σχέσης (`commit-signatory-service`: προμηθευτής → υπογράφων).
   * Ο υπογράφων είναι πάντα φυσικό πρόσωπο. Προεπιλογή `company`: η σάρωση προσφοράς δένει εταιρεία.
   */
  vendorContactType?: ContactType;
}

/**
 * Οι επιλογές τύπου έρχονται από το SSoT των σχέσεων επαφής (`getRelationshipTypeOptions`: πίνακας ADR-372 +
 * `VISUAL_REGISTRY`) — ΟΧΙ από δικό μας κατάλογο. Ο παλιός τοπικός χάρτης `STATIC_KEY_TO_I18N` πρόσφερε ΟΛΟ το
 * `RELATIONSHIP_METADATA`, μαζί με τους τύπους ακινήτου (ADR-244) που δεν έχουν ετικέτα σχέσης ⇒ ωμά κλειδιά.
 */
export function RelationshipTypePicker({
  value,
  onChange,
  disabled = false,
  vendorContactType = 'company',
}: RelationshipTypePickerProps) {
  const { t } = useTranslation('contacts-relationships');
  const { t: tQuotes } = useTranslation('quotes');
  const staticValue = value?.kind === 'static' ? value.type : undefined;
  const typeOptions = useMemo(
    () => getRelationshipTypeOptions(vendorContactType, t, staticValue, 'individual'),
    [vendorContactType, t, staticValue],
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customReverse, setCustomReverse] = useState('');

  const currentSelectValue =
    value?.kind === 'static' ? value.type : value?.kind === 'custom' ? CUSTOM_SENTINEL : '';

  const handleSelectChange = (next: string): void => {
    if (next === CUSTOM_SENTINEL) {
      onChange({ kind: 'custom', labelEl: customLabel.trim(), reverseLabelEl: customReverse.trim() || null });
      return;
    }
    onChange({ kind: 'static', type: next as RelationshipType });
  };

  const handleCustomLabelChange = (next: string): void => {
    setCustomLabel(next);
    onChange({
      kind: 'custom',
      labelEl: next.trim(),
      reverseLabelEl: customReverse.trim() || null,
    });
  };

  const handleCustomReverseChange = (next: string): void => {
    setCustomReverse(next);
    onChange({
      kind: 'custom',
      labelEl: customLabel.trim(),
      reverseLabelEl: next.trim() || null,
    });
  };

  const isCustomMode = value?.kind === 'custom';

  return (
    <div className="space-y-2">
      <Label htmlFor="signatory-rel-type" className="text-xs text-muted-foreground">
        {tQuotes('quotes.signatory.relationshipTypeLabel')}
      </Label>
      <Select value={currentSelectValue} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger id="signatory-rel-type">
          <SelectValue placeholder={tQuotes('quotes.signatory.relationshipTypePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
          <SelectItem value={CUSTOM_SENTINEL}>
            <span className="inline-flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" />
              {tQuotes('quotes.signatory.relationshipTypeCustomOption')}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {isCustomMode && (
        <div className="space-y-2 rounded-md border border-dashed border-muted-foreground/30 p-3">
          <div>
            <Label htmlFor="signatory-rel-custom-label" className="text-xs text-muted-foreground">
              {tQuotes('quotes.signatory.customLabelLabel')}
            </Label>
            <Input
              id="signatory-rel-custom-label"
              value={customLabel}
              onChange={(e) => handleCustomLabelChange(e.target.value)}
              placeholder={tQuotes('quotes.signatory.customLabelPlaceholder')}
              maxLength={80}
              disabled={disabled}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {tQuotes('quotes.signatory.advancedToggle')}
          </button>
          {advancedOpen && (
            <div>
              <Label htmlFor="signatory-rel-reverse" className="text-xs text-muted-foreground">
                {tQuotes('quotes.signatory.reverseLabelLabel')}
              </Label>
              <Input
                id="signatory-rel-reverse"
                value={customReverse}
                onChange={(e) => handleCustomReverseChange(e.target.value)}
                placeholder={tQuotes('quotes.signatory.reverseLabelPlaceholder')}
                maxLength={80}
                disabled={disabled}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {tQuotes('quotes.signatory.reverseLabelHint')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
