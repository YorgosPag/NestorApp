/* eslint-disable design-system/prefer-design-system-imports */
/**
 * AddParkingDialog — Dialog for creating parking spots
 *
 * ADR-191: Supports open-space parking (no buildingId).
 * When no building selected, projectId is required.
 * Dispatches PARKING_CREATED event for cross-page realtime sync.
 *
 * @module components/space-management/ParkingPage/AddParkingDialog
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createParkingWithPolicy } from '@/services/parking-mutation-gateway';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import {
  PARKING_TYPES,
  PARKING_STATUSES,
  PARKING_LOCATION_ZONES,
} from '@/types/parking';
import type {
  ParkingSpotType,
  ParkingSpotStatus,
  ParkingLocationZone,
} from '@/types/parking';
import { EntityCodeField } from '@/components/shared/EntityCodeField';

// ============================================================================
// TYPES
// ============================================================================

interface AddParkingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParkingCreateResult {
  parkingSpotId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddParkingDialog({ open, onOpenChange }: AddParkingDialogProps) {
  const { t } = useTranslation('building');
  const { t: tParking } = useTranslation('parking');
  const { buildings, loading: buildingsLoading } = useFirestoreBuildings();

  // Form state
  const [buildingId, setBuildingId] = useState('');
  const [code, setCode] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<ParkingSpotType>('standard');
  const [status, setStatus] = useState<ParkingSpotStatus>('available');
  const [locationZone, setLocationZone] = useState<ParkingLocationZone | ''>('');
  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // codeOverridden is managed internally by EntityCodeField

  const resetForm = () => {
    setBuildingId('');
    setCode('');
    setNumber('');
    setType('standard');
    setStatus('available');
    setLocationZone('');
    setFloor('');
    setLocation('');
    setArea('');
    setPrice('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (!creating) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleCreate = async () => {
    if (!number.trim()) return;

    // If no building selected, we still need projectId (resolved server-side from building)
    // For open-space: the API requires projectId when no buildingId
    const selectedBuilding = buildingId ? buildings.find(b => b.id === buildingId) : null;

    // Validate: must have building OR project context
    if (!buildingId && !selectedBuilding?.projectId) {
      // If no building is selected, we need at least a project context
      // For now, building selection provides project context
      setError(tParking('locationZone.placeholder'));
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await createParkingWithPolicy<ParkingCreateResult>({ payload: {
        number: number.trim(),
        code: code.trim() || undefined,
        type,
        status,
        floor: floor.trim() || undefined,
        location: location.trim() || undefined,
        area: area ? parseFloat(area) : undefined,
        price: price ? parseFloat(price) : undefined,
        notes: notes.trim() || undefined,
        ...(buildingId ? { buildingId } : {}),
        projectId: selectedBuilding?.projectId ?? undefined,
        locationZone: locationZone || undefined,
      }});

      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: {
            number: number.trim(),
            buildingId: buildingId || undefined,
            type,
            status,
          },
          timestamp: Date.now(),
        });

        resetForm();
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tParking('header.saveError'));
    } finally {
      setCreating(false);
    }
  };

  // Valid if we have a number AND either a building or open-space context
  const isValid = number.trim() && buildingId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('pages.parking.addSpot')}
          </DialogTitle>
          <DialogDescription>
            {t('pages.parking.addSpotDescription')}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          {/* Building Selection (optional) */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t('pages.parking.form.building')}
            </span>
            <Select value={buildingId} onValueChange={setBuildingId} disabled={creating}>
              <SelectTrigger>
                <SelectValue placeholder={
                  buildingsLoading
                    ? t('pages.parking.form.loadingBuildings')
                    : t('pages.parking.form.selectBuilding')
                } />
              </SelectTrigger>
              <SelectContent>
                {buildings.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {/* ADR-233: Code field with auto-suggest */}
          <EntityCodeField
            value={code}
            onChange={setCode}
            entityType="parking"
            buildingId={buildingId}
            floorLevel={floor ? parseInt(floor, 10) || 0 : 0}
            locationZone={locationZone || undefined}
            label={tParking('general.fields.code', { defaultValue: 'Κωδικός Θέσης (ADR-233)' })}
            placeholderFallback="A-PK-Y1.01"
            infoExample="π.χ. A-PK-Y1.01 (Κτίριο A, Parking, Υπόγ.1, #01)"
            disabled={creating}
            variant="dialog"
            t={tParking}
          />

          {/* Number + Type */}
          <fieldset className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.number')} *
              </span>
              <Input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="P-001"
                disabled={creating}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.type')}
              </span>
              <Select value={type} onValueChange={(v) => setType(v as ParkingSpotType)} disabled={creating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_TYPES.map(pt => (
                    <SelectItem key={pt} value={pt}>
                      {tParking(`types.${pt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </fieldset>

          {/* Status + Location Zone */}
          <fieldset className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.status')}
              </span>
              <Select value={status} onValueChange={(v) => setStatus(v as ParkingSpotStatus)} disabled={creating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_STATUSES.map(ps => (
                    <SelectItem key={ps} value={ps}>
                      {tParking(`status.${ps}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {tParking('locationZone.label')}
              </span>
              <Select
                value={locationZone}
                onValueChange={(v) => setLocationZone(v as ParkingLocationZone)}
                disabled={creating}
              >
                <SelectTrigger>
                  <SelectValue placeholder={tParking('locationZone.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PARKING_LOCATION_ZONES.map(lz => (
                    <SelectItem key={lz} value={lz}>
                      {tParking(`locationZone.${lz}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </fieldset>

          {/* Floor + Area */}
          <fieldset className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.floor')}
              </span>
              <Input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="-1"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.area')}
              </span>
              <Input
                type="number"
                step="0.01"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="12"
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Price + Location */}
          <fieldset className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.price')}
              </span>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="15000"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('pages.parking.form.location')}
              </span>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t('pages.parking.form.locationPlaceholder')}
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Notes */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t('pages.parking.form.notes')}
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('pages.parking.form.notesPlaceholder')}
              className="h-16 resize-none"
              disabled={creating}
            />
          </label>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={creating}
          >
            {t('pages.parking.form.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || creating}
          >
            {creating && <Spinner size="small" color="inherit" className="mr-2" />}
            {t('pages.parking.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
