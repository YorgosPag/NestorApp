/**
 * AddParkingDialog — Dialog for creating parking spots from the sidebar Parking page
 *
 * Allows users to create new parking spots without navigating to Building Tab.
 * Dispatches PARKING_CREATED event for cross-page realtime sync.
 *
 * @module components/space-management/ParkingPage/AddParkingDialog
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { useFirestoreBuildings } from '@/hooks/useFirestoreBuildings';
import { RealtimeService } from '@/services/realtime/RealtimeService';
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
import { Loader2 } from 'lucide-react';
import type { ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';

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
// CONSTANTS
// ============================================================================

const PARKING_TYPES: { value: ParkingSpotType; label: string }[] = [
  { value: 'standard', label: 'Κανονική' },
  { value: 'handicapped', label: 'ΑμεΑ' },
  { value: 'motorcycle', label: 'Μοτοσυκλέτα' },
  { value: 'electric', label: 'Ηλεκτρικό' },
  { value: 'visitor', label: 'Επισκέπτης' },
];

const PARKING_STATUSES: { value: ParkingSpotStatus; label: string }[] = [
  { value: 'available', label: 'Διαθέσιμη' },
  { value: 'occupied', label: 'Κατειλημμένη' },
  { value: 'reserved', label: 'Δεσμευμένη' },
  { value: 'sold', label: 'Πωλημένη' },
  { value: 'maintenance', label: 'Συντήρηση' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AddParkingDialog({ open, onOpenChange }: AddParkingDialogProps) {
  const { t } = useTranslation('building');
  const { buildings, loading: buildingsLoading } = useFirestoreBuildings();

  // Form state
  const [buildingId, setBuildingId] = useState('');
  const [number, setNumber] = useState('');
  const [type, setType] = useState<ParkingSpotType>('standard');
  const [status, setStatus] = useState<ParkingSpotStatus>('available');
  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setBuildingId('');
    setNumber('');
    setType('standard');
    setStatus('available');
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
    if (!buildingId || !number.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const selectedBuilding = buildings.find(b => b.id === buildingId);

      const result = await apiClient.post<ParkingCreateResult>('/api/parking', {
        number: number.trim(),
        type,
        status,
        floor: floor.trim() || undefined,
        location: location.trim() || undefined,
        area: area ? parseFloat(area) : undefined,
        price: price ? parseFloat(price) : undefined,
        notes: notes.trim() || undefined,
        buildingId,
        projectId: selectedBuilding?.projectId ?? undefined,
      });

      if (result?.parkingSpotId) {
        RealtimeService.dispatchParkingCreated({
          parkingSpotId: result.parkingSpotId,
          parkingSpot: {
            number: number.trim(),
            buildingId,
            type,
            status,
          },
          timestamp: Date.now(),
        });

        resetForm();
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Αποτυχία δημιουργίας');
    } finally {
      setCreating(false);
    }
  };

  const isValid = buildingId && number.trim();

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
          {/* Building Selection */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t('pages.parking.form.building')} *
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
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </fieldset>

          {/* Status + Floor */}
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
                    <SelectItem key={ps.value} value={ps.value}>
                      {ps.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
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
          </fieldset>

          {/* Area + Price */}
          <fieldset className="grid grid-cols-2 gap-3">
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
          </fieldset>

          {/* Location + Notes */}
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
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('pages.parking.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
