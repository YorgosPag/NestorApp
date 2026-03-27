/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * UnitInlineCreateForm — Extracted inline create form for units in Building Management.
 *
 * Google SRP: This component owns ALL create-form state, validation, and submission.
 * The parent (UnitsTabContent) only controls visibility and receives success callback.
 *
 * Labels match Διαχείριση Μονάδων (SSOT via units i18n namespace).
 * Code field uses EntityCodeField (ADR-233) — same as AddUnitDialog.
 *
 * @module components/building-management/tabs/UnitInlineCreateForm
 */

import { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createUnit } from '@/services/units.service';
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
import type { UnitType, CommercialStatus, OperationalStatus } from '@/types/unit';
import {
  UNIT_TYPE_LABEL_KEYS, UNIT_TYPES_FOR_FILTER,
  CREATION_COMMERCIAL_OPTION_KEYS, OPERATIONAL_STATUS_OPTION_KEYS,
} from './unit-tab-constants';
import type { FloorRecord } from './unit-tab-constants';

// ============================================================================
// TYPES
// ============================================================================

interface UnitInlineCreateFormProps {
  buildingId: string;
  buildingName: string;
  floors: FloorRecord[];
  onCreated: () => void;
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UnitInlineCreateForm({
  buildingId,
  buildingName,
  floors,
  onCreated,
  onCancel,
}: UnitInlineCreateFormProps) {
  const { t: tUnits } = useTranslation('units');
  const colors = useSemanticColors();
  const { success, error: notifyError } = useNotifications();

  // Row 1 fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<UnitType>('apartment');
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

  const handleCreate = async () => {
    if (!name.trim()) {
      notifyError(tUnits('inlineCreate.nameRequired'));
      return;
    }

    setCreating(true);
    try {
      const unitData: Record<string, unknown> = {
        name: name.trim(),
        type,
        buildingId,
        building: buildingName,
        floor: floor ? parseInt(floor, 10) : 0,
        project: '',
        status: commercialStatus,
        operationalStatus,
        vertices: [],
      };

      if (code.trim()) unitData.code = code.trim();
      if (askingPrice) {
        unitData.commercial = { askingPrice: parseFloat(askingPrice) };
      }

      const areas: Record<string, number> = {};
      if (areaNet) areas.net = parseFloat(areaNet);
      if (areaGross) areas.gross = parseFloat(areaGross);
      if (Object.keys(areas).length > 0) unitData.areas = areas;
      if (areaNet) unitData.area = parseFloat(areaNet);

      const layout: Record<string, number> = {};
      if (bedrooms) layout.bedrooms = parseInt(bedrooms, 10);
      if (bathrooms) layout.bathrooms = parseInt(bathrooms, 10);
      if (wc) layout.wc = parseInt(wc, 10);
      if (Object.keys(layout).length > 0) unitData.layout = layout;

      const result = await createUnit(unitData);

      if (result.success) {
        success(tUnits('inlineCreate.created'));
        onCreated();
      } else {
        notifyError(result.error || tUnits('inlineCreate.createError'));
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : tUnits('inlineCreate.createError'));
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
            {tUnits('fields.identity.name', { defaultValue: 'Όνομα Μονάδας' })} *
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tUnits('fields.identity.namePlaceholder')}
            className="h-9"
            disabled={creating}
            autoFocus
          />
        </label>
        <EntityCodeField
          value={code}
          onChange={setCode}
          entityType="unit"
          buildingId={buildingId}
          floorLevel={floor ? parseInt(floor, 10) || 0 : 0}
          unitType={type || undefined}
          label={tUnits('fields.identity.code', { defaultValue: 'Κωδικός Μονάδας' })}
          placeholderFallback="A-DI-1.01"
          infoExample={tUnits('inlineCreate.codeInfoExample')}
          disabled={creating}
          variant="dialog"
          t={tUnits}
        />
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {tUnits('fields.identity.type', { defaultValue: 'Τύπος Μονάδας' })}
          </span>
          <Select value={type} onValueChange={(v) => setType(v as UnitType)} disabled={creating}>
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
            {tUnits('fields.identity.commercialStatus', { defaultValue: 'Εμπορική Κατάσταση' })}
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
            {tUnits('fields.identity.unitStatus', { defaultValue: 'Λειτουργική Κατάσταση' })}
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
          <Input type="number" step="0.1" value={areaGross} onChange={(e) => setAreaGross(e.target.value)} placeholder="90" className="h-9" disabled={creating} />
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
