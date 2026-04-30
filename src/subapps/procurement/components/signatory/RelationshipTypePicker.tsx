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

import { useState } from 'react';
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
import { RELATIONSHIP_METADATA } from '@/types/contacts/relationships/core/relationship-metadata';
import type { RelationshipType } from '@/types/contacts/relationships/core/relationship-types';
import type { RelationshipTypeChoice } from './types';

const CUSTOM_SENTINEL = '__custom__';

const STATIC_TYPE_KEYS = Object.keys(RELATIONSHIP_METADATA) as RelationshipType[];

interface RelationshipTypePickerProps {
  value: RelationshipTypeChoice | null;
  onChange: (next: RelationshipTypeChoice | null) => void;
  disabled?: boolean;
  /** i18n key prefix for static type labels (e.g. 'relationships.types'). */
  staticLabelPrefix?: string;
}

/**
 * Static keys are stored in code as snake_case (e.g. 'board_member') but the
 * el locale uses camelCase keys for some entries (e.g. 'boardMember'). Map
 * once here so the labels render correctly without locale rewrites.
 */
const STATIC_KEY_TO_I18N: Record<RelationshipType, string> = {
  employee: 'employee', manager: 'manager', director: 'director', executive: 'executive',
  intern: 'intern', contractor: 'contractor', consultant: 'consultant',
  shareholder: 'shareholder', board_member: 'boardMember', chairman: 'chairman',
  ceo: 'ceo', representative: 'representative', partner: 'partner',
  vendor: 'vendor', client: 'client',
  civil_servant: 'civilServant', elected_official: 'electedOfficial',
  appointed_official: 'appointedOfficial', department_head: 'departmentHead',
  ministry_official: 'ministryOfficial', mayor: 'mayor', deputy_mayor: 'deputyMayor',
  regional_governor: 'regionalGovernor', advisor: 'advisor', mentor: 'mentor',
  protege: 'protege', colleague: 'colleague', supplier: 'supplier',
  customer: 'customer', competitor: 'competitor', business_contact: 'businessContact',
  friend: 'friend', family: 'family', other: 'other',
  property_buyer: 'propertyBuyer', property_co_buyer: 'propertyCoBuyer',
  property_landowner: 'propertyLandowner',
};

export function RelationshipTypePicker({
  value,
  onChange,
  disabled = false,
  staticLabelPrefix = 'relationships.types',
}: RelationshipTypePickerProps) {
  const { t } = useTranslation('contacts-relationships');
  const { t: tQuotes } = useTranslation('quotes');
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
          {STATIC_TYPE_KEYS.map((typeKey) => (
            <SelectItem key={typeKey} value={typeKey}>
              {t(`${staticLabelPrefix}.${STATIC_KEY_TO_I18N[typeKey]}`)}
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
