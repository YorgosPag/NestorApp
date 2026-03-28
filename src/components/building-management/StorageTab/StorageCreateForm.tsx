/**
 * 📄 STORAGE CREATE FORM — Inline create form for new storage units
 *
 * Extracted from StorageTab.tsx (Google SRP).
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import '@/lib/design-system';
import type { StorageType, StorageStatus } from '@/types/storage';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
import { Spinner } from '@/components/ui/spinner';
import { Check, X } from 'lucide-react';

const STORAGE_TYPES: StorageType[] = ['storage', 'large', 'small', 'basement', 'ground', 'special', 'garage', 'warehouse'];
const STORAGE_STATUSES: StorageStatus[] = ['available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable'];

interface StorageCreateFormProps {
  code: string;
  onCodeChange: (v: string) => void;
  type: StorageType;
  onTypeChange: (v: StorageType) => void;
  status: StorageStatus;
  onStatusChange: (v: StorageStatus) => void;
  floor: string;
  onFloorChange: (v: string) => void;
  area: string;
  onAreaChange: (v: string) => void;
  price: string;
  onPriceChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  creating: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  translatedGetTypeLabel: (type: StorageType) => string;
  translatedGetStatusLabel: (status: StorageStatus) => string;
  t: (key: string) => string;
}

export function StorageCreateForm({
  code, onCodeChange,
  type, onTypeChange,
  status, onStatusChange,
  floor, onFloorChange,
  area, onAreaChange,
  price, onPriceChange,
  description, onDescriptionChange,
  creating, onSubmit, onCancel,
  translatedGetTypeLabel, translatedGetStatusLabel, t,
}: StorageCreateFormProps) {
  const colors = useSemanticColors();

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      {/* Row 1: Code, Type, Status */}
      <fieldset className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>
            {t('storageTable.columns.code')}
          </span>
          <Input value={code} onChange={(e) => onCodeChange(e.target.value)} placeholder="A-001" className="h-9" disabled={creating} autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>
            {t('storageTable.columns.type')}
          </span>
          <Select value={type} onValueChange={(v) => onTypeChange(v as StorageType)} disabled={creating}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STORAGE_TYPES.map((st) => (
                <SelectItem key={st} value={st}>{translatedGetTypeLabel(st)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>
            {t('storageTable.columns.status')}
          </span>
          <Select value={status} onValueChange={(v) => onStatusChange(v as StorageStatus)} disabled={creating}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STORAGE_STATUSES.map((ss) => (
                <SelectItem key={ss} value={ss}>{translatedGetStatusLabel(ss)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </fieldset>

      {/* Row 2: Floor, Area, Price */}
      <fieldset className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>
            {t('storageTable.columns.floor')}
          </span>
          <Input value={floor} onChange={(e) => onFloorChange(e.target.value)} placeholder="-1" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>m²</span>
          <Input type="number" step="0.01" value={area} onChange={(e) => onAreaChange(e.target.value)} placeholder="12" className="h-9" disabled={creating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-medium', colors.text.muted)}>
            {t('storageTable.columns.price')} (€)
          </span>
          <Input type="number" step="0.01" value={price} onChange={(e) => onPriceChange(e.target.value)} placeholder="5000" className="h-9" disabled={creating} />
        </label>
      </fieldset>

      {/* Row 3: Description */}
      <label className="flex flex-col gap-1">
        <span className={cn('text-xs font-medium', colors.text.muted)}>
          {t('storage.form.description')}
        </span>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t('storage.form.placeholders.descriptionStorage')}
          className="h-16 resize-none"
          disabled={creating}
        />
      </label>

      {/* Actions */}
      <nav className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={creating}>
          <X className="mr-1 h-4 w-4" />
          {t('storage.form.footer.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={creating}>
          {creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
          {t('storage.form.footer.save')}
        </Button>
      </nav>
    </form>
  );
}
