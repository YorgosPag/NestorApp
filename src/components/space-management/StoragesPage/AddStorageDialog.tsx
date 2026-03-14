/**
 * AddStorageDialog — Dialog for creating storage units
 *
 * Mirrors AddParkingDialog pattern.
 * Dispatches STORAGE_CREATED event for cross-page realtime sync.
 *
 * @module components/space-management/StoragesPage/AddStorageDialog
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
import { Spinner } from '@/components/ui/spinner';
import type { StorageType, StorageStatus } from '@/types/storage/contracts';
import { typeLabels, statusLabels } from '@/types/storage/constants';

// ============================================================================
// TYPES
// ============================================================================

interface AddStorageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StorageCreateResult {
  storageId: string;
}

// Type/status arrays derived from the label records (single source of truth)
const STORAGE_TYPES = Object.keys(typeLabels) as StorageType[];
const STORAGE_STATUSES = Object.keys(statusLabels) as StorageStatus[];

// ============================================================================
// COMPONENT
// ============================================================================

export function AddStorageDialog({ open, onOpenChange }: AddStorageDialogProps) {
  const { t } = useTranslation('storage');
  const { t: tBuilding } = useTranslation('building');
  const { buildings, loading: buildingsLoading } = useFirestoreBuildings();

  // Form state
  const [buildingId, setBuildingId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<StorageType>('storage');
  const [status, setStatus] = useState<StorageStatus>('available');
  const [floor, setFloor] = useState('');
  const [area, setArea] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setBuildingId('');
    setName('');
    setType('storage');
    setStatus('available');
    setFloor('');
    setArea('');
    setPrice('');
    setDescription('');
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
    if (!name.trim() || !buildingId) return;

    setCreating(true);
    setError(null);

    try {
      const result = await apiClient.post<StorageCreateResult>('/api/storages', {
        name: name.trim(),
        buildingId,
        type,
        status,
        floor: floor.trim() || undefined,
        area: area ? parseFloat(area) : undefined,
        price: price ? parseFloat(price) : undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result?.storageId) {
        RealtimeService.dispatch('STORAGE_CREATED', {
          storageId: result.storageId,
          storage: {
            name: name.trim(),
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
      setError(err instanceof Error ? err.message : t('storages.form.createError', 'Σφάλμα δημιουργίας'));
    } finally {
      setCreating(false);
    }
  };

  const isValid = name.trim() && buildingId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('storages.header.newStorage', 'Νέα Αποθήκη')}
          </DialogTitle>
          <DialogDescription>
            {t('storages.form.createDescription', 'Συμπλήρωσε τα στοιχεία για τη νέα αποθήκη')}
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          {/* Building Selection */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {tBuilding('pages.parking.form.building', 'Κτίριο')} *
            </span>
            <Select value={buildingId} onValueChange={setBuildingId} disabled={creating}>
              <SelectTrigger>
                <SelectValue placeholder={
                  buildingsLoading
                    ? tBuilding('pages.parking.form.loadingBuildings', 'Φόρτωση...')
                    : tBuilding('pages.parking.form.selectBuilding', 'Επιλέξτε κτίριο')
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

          {/* Name + Type */}
          <fieldset className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('storages.form.name', 'Όνομα')} *
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ΑΠ-001"
                disabled={creating}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('storages.form.type', 'Τύπος')}
              </span>
              <Select value={type} onValueChange={(v) => setType(v as StorageType)} disabled={creating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_TYPES.map(st => (
                    <SelectItem key={st} value={st}>
                      {t(typeLabels[st], st)}
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
                {t('storages.form.status', 'Κατάσταση')}
              </span>
              <Select value={status} onValueChange={(v) => setStatus(v as StorageStatus)} disabled={creating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_STATUSES.map(ss => (
                    <SelectItem key={ss} value={ss}>
                      {t(statusLabels[ss], ss)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('storages.form.floor', 'Όροφος')}
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
                {t('storages.form.area', 'Εμβαδόν (m²)')}
              </span>
              <Input
                type="number"
                step="0.01"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="25"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                {t('storages.form.price', 'Τιμή (€)')}
              </span>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="5000"
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Description */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t('storages.form.description', 'Περιγραφή')}
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('storages.form.descriptionPlaceholder', 'Προαιρετική περιγραφή...')}
              className="h-16 resize-none"
              disabled={creating}
            />
          </label>

          {/* Notes */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {t('storages.form.notes', 'Σημειώσεις')}
            </span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('storages.form.notesPlaceholder', 'Προαιρετικές σημειώσεις...')}
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
            {t('storages.form.cancel', 'Ακύρωση')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || creating}
          >
            {creating && <Spinner size="small" color="inherit" className="mr-2" />}
            {t('storages.form.create', 'Δημιουργία')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
