/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * PropertyInlineCreateForm — Extracted inline create form for properties in Building Management.
 *
 * Google SRP: This component owns ALL create-form state, validation, and submission.
 * The parent (PropertiesTabContent) only controls visibility and receives success callback.
 *
 * Labels match Διαχείριση Μονάδων (SSOT via units i18n namespace).
 * Code field uses EntityCodeField (ADR-233) — same as AddPropertyDialog.
 *
 * @module components/building-management/tabs/PropertyInlineCreateForm
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createPropertyWithPolicy } from '@/services/property/property-mutation-gateway';
import { isStandaloneUnitType } from '@/hooks/properties/usePropertyCreateValidation';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { EntityCodeField } from '@/components/shared/EntityCodeField';
import type { PropertyType, CommercialStatus, OperationalStatus } from '@/types/property';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import {
  UNIT_TYPE_LABEL_KEYS, UNIT_TYPES_FOR_FILTER,
  CREATION_COMMERCIAL_OPTION_KEYS, OPERATIONAL_STATUS_OPTION_KEYS,
} from './property-tab-constants';
import type { FloorRecord } from './property-tab-constants';

// ============================================================================
// TYPES
// ============================================================================

interface PropertyInlineCreateFormProps {
  buildingId: string;
  buildingName: string;
  /** ADR-284 Batch 7: Project that the Building belongs to (required for server policy). */
  projectId: string;
  floors: FloorRecord[];
  onCreated: () => void;
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PropertyInlineCreateForm({
  buildingId,
  buildingName,
  projectId,
  floors,
  onCreated,
  onCancel,
}: PropertyInlineCreateFormProps) {
  const { t: tUnits } = useTranslation('properties');
  const colors = useSemanticColors();
  const { success, error: notifyError } = useNotifications();

  // Row 1 fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<PropertyType>('apartment');
  const [commercialStatus, setCommercialStatus] = useState<CommercialStatus>('for-sale');
  const [askingPrice, setAskingPrice] = useState('');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('draft');

  // Row 2 fields
  const [floor, setFloor] = useState('');
  const [areaNet, setAreaNet] = useState('');
  const [areaGross, setAreaGross] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [wc, setWC] = useState('');

  const [creating, setCreating] = useState(false);

  // ── Auto-suggest name based on type + area ──
  // Tracks whether user manually edited the name field.
  // If not, name auto-updates when type or areaNet changes.
  const userEditedName = useRef(false);

  const buildSuggestedName = useCallback((unitType: PropertyType, grossArea: number): string => {
    const typeLabel = UNIT_TYPE_LABEL_KEYS[unitType]
      ? tUnits(UNIT_TYPE_LABEL_KEYS[unitType])
      : unitType;
    if (grossArea > 0) {
      return `${typeLabel} ${grossArea} ${tUnits('units.sqm')}`;
    }
    return typeLabel;
  }, [tUnits]);

  const handleTypeChange = (newType: PropertyType) => {
    setType(newType);
    if (!userEditedName.current) {
      setName(buildSuggestedName(newType, parseFloat(areaGross) || 0));
    }
  };

  const handleAreaGrossChange = (newArea: string) => {
    setAreaGross(newArea);
    if (!userEditedName.current) {
      setName(buildSuggestedName(type, parseFloat(newArea) || 0));
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // Mark as manually edited if user types something different from the suggestion
    userEditedName.current = true;
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      notifyError(tUnits('inlineCreate.nameRequired'));
      return;
    }

    // ADR-284 Batch 7: Standalone type guard — this inline form is per-Building (Family A).
    // Standalone units (villa, detached_house) attach directly to Project, not Building.
    if (isStandaloneUnitType(type)) {
      notifyError(tUnits('inlineCreate.standaloneNotAllowed'));
      return;
    }

    // Resolve floorId from selected floor number (FloorRecord has id+number)
    const floorNum = floor ? parseInt(floor, 10) : NaN;
    const selectedFloor = Number.isFinite(floorNum)
      ? floors.find((f) => f.number === floorNum)
      : undefined;

    setCreating(true);
    try {
      const propertyData: Record<string, unknown> = {
        name: name.trim(),
        type,
        // ADR-284 Batch 7: Hierarchy fields (Family A)
        projectId,
        buildingId,
        ...(selectedFloor ? { floorId: selectedFloor.id } : {}),
        building: buildingName,
        floor: Number.isFinite(floorNum) ? floorNum : 0,
        project: '',
        status: commercialStatus,
        operationalStatus,
        vertices: [],
      };

      if (code.trim()) propertyData.code = code.trim();
      if (askingPrice) {
        propertyData.commercial = { askingPrice: parseFloat(askingPrice) };
      }

      const areas: Record<string, number> = {};
      if (areaNet) areas.net = parseFloat(areaNet);
      if (areaGross) areas.gross = parseFloat(areaGross);
      if (Object.keys(areas).length > 0) propertyData.areas = areas;
      if (areaNet) propertyData.area = parseFloat(areaNet);

      const layout: Record<string, number> = {};
      if (bedrooms) layout.bedrooms = parseInt(bedrooms, 10);
      if (bathrooms) layout.bathrooms = parseInt(bathrooms, 10);
      if (wc) layout.wc = parseInt(wc, 10);
      if (Object.keys(layout).length > 0) propertyData.layout = layout;

      const result = await createPropertyWithPolicy({ propertyData });

      if (result.success) {
        success(tUnits('inlineCreate.created'));
        onCreated();
      } else {
        notifyError(result.error || tUnits('inlineCreate.createError'));
      }
    } catch (err) {
      notifyError(translatePropertyMutationError(
        err,
        tUnits,
        'inlineCreate.createError',
      ));
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
    >
      {/* Row 1: Όνομα, Κωδικός (ADR-233), Τύπος, Εμπορική, Ζητούμενη Τιμή, Λειτουργική */}
      <fieldset className="grid grid-cols-6 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('fields.identity.name')} *
          </span>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={tUnits('fields.identity.namePlaceholder')}
            className="h-9"
            disabled={creating}
            autoFocus
          />
        </label>
        <EntityCodeField
          value={code}
          onChange={setCode}
          entityType="property"
          buildingId={buildingId}
          floorLevel={floor ? parseInt(floor, 10) || 0 : 0}
          propertyType={type || undefined}
          label={tUnits('fields.identity.code')}
          placeholderFallback="A-DI-1.01"
          infoExample={tUnits('inlineCreate.codeInfoExample')}
          disabled={creating}
          variant="dialog"
          t={tUnits}
        />
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('fields.identity.type')}
          </span>
          <Select value={type} onValueChange={(v) => handleTypeChange(v as PropertyType)} disabled={creating}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_TYPES_FOR_FILTER.map(ut => (
                <SelectItem key={ut} value={ut}>{UNIT_TYPE_LABEL_KEYS[ut] ? tUnits(UNIT_TYPE_LABEL_KEYS[ut]) : ut}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('fields.identity.commercialStatus')}
          </span>
          <Select value={commercialStatus} onValueChange={(v) => setCommercialStatus(v as CommercialStatus)} disabled={creating}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATION_COMMERCIAL_OPTION_KEYS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{tUnits(opt.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('inlineCreate.askingPrice')}
          </span>
          <Input
            type="number"
            step="1000"
            value={askingPrice}
            onChange={(e) => setAskingPrice(e.target.value)}
            placeholder="€"
            className="h-9"
            disabled={creating}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('fields.identity.propertyStatus')}
          </span>
          <Select value={operationalStatus} onValueChange={(v) => setOperationalStatus(v as OperationalStatus)} disabled={creating}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATIONAL_STATUS_OPTION_KEYS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{tUnits(opt.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </fieldset>

      {/* Row 2: Όροφος, Καθαρά m², Μικτά m², Υ/Δ, Μπάνια, WC */}
      <fieldset className="grid grid-cols-6 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.floor')}</span>
          {floors.length > 0 ? (
            <Select value={floor} onValueChange={setFloor} disabled={creating}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={tUnits('inlineCreate.selectFloor')} />
              </SelectTrigger>
              <SelectContent>
                {floors.map(f => (
                  <SelectItem key={f.id} value={String(f.number)}>
                    {f.name} ({f.number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="0"
              className="h-9"
              disabled={creating}
            />
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.netArea')}</span>
          <Input type="number" step="0.1" value={areaNet} onChange={(e) => setAreaNet(e.target.value)} placeholder="75" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.grossArea')}</span>
          <Input type="number" step="0.1" value={areaGross} onChange={(e) => handleAreaGrossChange(e.target.value)} placeholder="90" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.bedrooms')}</span>
          <Input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="2" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.bathrooms')}</span>
          <Input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="1" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>{tUnits('inlineCreate.wc')}</span>
          <Input type="number" value={wc} onChange={(e) => setWC(e.target.value)} placeholder="1" className="h-9" disabled={creating} />
        </label>
      </fieldset>

      {/* Actions */}
      <nav className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={creating}>
          <X className="mr-1 h-4 w-4" />
          {tUnits('inlineCreate.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={creating || !name.trim()}>
          {creating ? <Spinner className="mr-1 h-4 w-4" /> : <Check className="mr-1 h-4 w-4" />}
          {tUnits('inlineCreate.save')}
        </Button>
      </nav>
    </form>
  );
}
