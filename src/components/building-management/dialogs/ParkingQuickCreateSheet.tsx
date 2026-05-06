'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { DIALOG_SCROLL } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useEntityNameSuggestion } from '@/hooks/useEntityNameSuggestion';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createParkingWithPolicy } from '@/services/parking-mutation-gateway';
import { createModuleLogger } from '@/lib/telemetry';
import type { ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';
import { PARKING_TYPES, PARKING_STATUSES, PARKING_LOCATION_ZONES } from '@/types/parking';

const logger = createModuleLogger('ParkingQuickCreateSheet');

interface ParkingCreateResult { parkingSpotId: string }

export interface ParkingQuickCreateSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly buildingId: string;
  readonly projectId: string;
  readonly onParkingCreated?: () => void;
}

export function ParkingQuickCreateSheet({
  open,
  onOpenChange,
  buildingId,
  projectId,
  onParkingCreated,
}: ParkingQuickCreateSheetProps) {
  const { t } = useTranslation('parking');
  const { t: tBuilding } = useTranslation('building');
  const colors = useSemanticColors();
  const { buildName } = useEntityNameSuggestion('parking');

  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createStatus, setCreateStatus] = useState<ParkingSpotStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLocationZone, setCreateLocationZone] = useState<ParkingLocationZone | ''>('');
  const [creating, setCreating] = useState(false);
  const nameManuallyChanged = useRef(false);

  const reset = useCallback(() => {
    setCreateNumber('');
    nameManuallyChanged.current = false;
    setCreateType('standard');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateLocation('');
    setCreateArea('');
    setCreatePrice('');
    setCreateNotes('');
    setCreateLocationZone('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const handleNumberChange = useCallback((value: string) => {
    setCreateNumber(value);
    nameManuallyChanged.current = true;
  }, []);

  const handleTypeChange = useCallback((v: ParkingSpotType) => {
    setCreateType(v);
    if (!nameManuallyChanged.current) {
      setCreateNumber(buildName(t(`types.${v}`), parseFloat(createArea) || 0));
    }
  }, [buildName, t, createArea]);

  const handleAreaChange = useCallback((value: string) => {
    setCreateArea(value);
    if (!nameManuallyChanged.current) {
      setCreateNumber(buildName(t(`types.${createType}`), parseFloat(value) || 0));
    }
  }, [buildName, t, createType]);

  const handleCreate = useCallback(async () => {
    if (!createNumber.trim()) return;
    setCreating(true);
    try {
      const result = await createParkingWithPolicy<ParkingCreateResult>({
        payload: {
          number: createNumber.trim(),
          type: createType,
          status: createStatus,
          floor: createFloor.trim() || undefined,
          location: createLocation.trim() || undefined,
          area: createArea ? parseFloat(createArea) : undefined,
          price: createPrice ? parseFloat(createPrice) : undefined,
          notes: createNotes.trim() || undefined,
          locationZone: createLocationZone || undefined,
          buildingId,
          projectId,
        },
      });
      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: { number: createNumber.trim(), buildingId, type: createType, status: createStatus },
          timestamp: Date.now(),
        });
        reset();
        onParkingCreated?.();
        onOpenChange(false);
      }
    } catch (err) {
      logger.error('Create parking error', { error: err });
    } finally {
      setCreating(false);
    }
  }, [
    createNumber, createType, createStatus, createFloor, createLocation,
    createArea, createPrice, createNotes, createLocationZone,
    buildingId, projectId, reset, onParkingCreated, onOpenChange,
  ]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          'w-[min(960px,96vw)] sm:max-w-none p-0 flex flex-col',
          DIALOG_SCROLL.scrollable,
        )}
      >
        <SheetHeader className="p-4 border-b">
          <SheetTitle>{tBuilding('details.addParkingTitle')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          {open && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
            >
              <fieldset className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('general.fields.spotName')} *
                  </span>
                  <Input
                    value={createNumber}
                    onChange={(e) => handleNumberChange(e.target.value)}
                    placeholder="P-001"
                    className="h-9"
                    disabled={creating}
                    autoFocus
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('general.fields.type')}
                  </span>
                  <Select value={createType} onValueChange={(v) => handleTypeChange(v as ParkingSpotType)} disabled={creating}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PARKING_TYPES.map(pt => (
                        <SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('general.fields.status')}
                  </span>
                  <Select value={createStatus} onValueChange={(v) => setCreateStatus(v as ParkingSpotStatus)} disabled={creating}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PARKING_STATUSES.map(ps => (
                        <SelectItem key={ps} value={ps}>{t(`status.${ps}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </fieldset>

              <fieldset className="grid grid-cols-4 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('locationZone.label')}
                  </span>
                  <Select value={createLocationZone} onValueChange={(v) => setCreateLocationZone(v as ParkingLocationZone)} disabled={creating}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t('locationZone.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PARKING_LOCATION_ZONES.map(lz => (
                        <SelectItem key={lz} value={lz}>{t(`locationZone.${lz}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('general.fields.floor')}
                  </span>
                  <Input
                    value={createFloor}
                    onChange={(e) => setCreateFloor(e.target.value)}
                    placeholder="-1"
                    className="h-9"
                    disabled={creating}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>m²</span>
                  <Input
                    type="number" step="0.01"
                    value={createArea}
                    onChange={(e) => handleAreaChange(e.target.value)}
                    placeholder="12"
                    className="h-9"
                    disabled={creating}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={cn('text-xs font-medium', colors.text.muted)}>
                    {t('general.fields.price')} (€)
                  </span>
                  <Input
                    type="number" step="0.01"
                    value={createPrice}
                    onChange={(e) => setCreatePrice(e.target.value)}
                    placeholder="15000"
                    className="h-9"
                    disabled={creating}
                  />
                </label>
              </fieldset>

              <label className="flex flex-col gap-1">
                <span className={cn('text-xs font-medium', colors.text.muted)}>
                  {t('general.notes')}
                </span>
                <Textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder={t('general.notes')}
                  className="h-20 resize-none"
                  disabled={creating}
                />
              </label>

              <nav className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleClose} disabled={creating}>
                  <X className="mr-1 h-4 w-4" />
                  {t('header.cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={!createNumber.trim() || creating}>
                  {creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
                  {t('header.save')}
                </Button>
              </nav>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
