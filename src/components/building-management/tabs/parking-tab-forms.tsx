'use client';

import '@/lib/design-system';
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
import { TableCell } from '@/components/ui/table';
import { Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ParkingSpotType, ParkingSpotStatus, ParkingLocationZone } from '@/types/parking';
import { PARKING_TYPES, PARKING_STATUSES, PARKING_LOCATION_ZONES } from '@/types/parking';
import { useParkingTabState } from './useParkingTabState';

interface ParkingCreateFormProps {
  state: ReturnType<typeof useParkingTabState>;
  t: (key: string, options?: Record<string, string>) => string;
  colors: ReturnType<typeof useSemanticColors>;
}

export function ParkingCreateForm({ state, t, colors }: ParkingCreateFormProps) {
  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
      onSubmit={(e) => { e.preventDefault(); state.handleCreate(); }}
    >
      <fieldset className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.spotName')} *
          </span>
          <Input
            value={state.createNumber}
            onChange={(e) => state.handleCreateNumberChange(e.target.value)}
            placeholder="P-001"
            className="h-9"
            disabled={state.creating}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.type')}
          </span>
          <Select value={state.createType} onValueChange={(v) => state.handleCreateTypeChange(v as ParkingSpotType)} disabled={state.creating}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PARKING_TYPES.map(pt => (
                <SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.status')}
          </span>
          <Select value={state.createStatus} onValueChange={(v) => state.setCreateStatus(v as ParkingSpotStatus)} disabled={state.creating}>
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
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('locationZone.label')}
          </span>
          <Select value={state.createLocationZone} onValueChange={(v) => state.setCreateLocationZone(v as ParkingLocationZone)} disabled={state.creating}>
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
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.floor')}
          </span>
          <Input
            value={state.createFloor}
            onChange={(e) => state.setCreateFloor(e.target.value)}
            placeholder="-1"
            className="h-9"
            disabled={state.creating}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>m²</span>
          <Input
            type="number" step="0.01"
            value={state.createArea}
            onChange={(e) => state.handleCreateAreaChange(e.target.value)}
            placeholder="12"
            className="h-9"
            disabled={state.creating}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn("text-xs font-medium", colors.text.muted)}>
            {t('general.fields.price')} (€)
          </span>
          <Input
            type="number" step="0.01"
            value={state.createPrice}
            onChange={(e) => state.setCreatePrice(e.target.value)}
            placeholder="15000"
            className="h-9"
            disabled={state.creating}
          />
        </label>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className={cn("text-xs font-medium", colors.text.muted)}>
          {t('general.notes')}
        </span>
        <Textarea
          value={state.createNotes}
          onChange={(e) => state.setCreateNotes(e.target.value)}
          placeholder={t('general.notes')}
          className="h-16 resize-none"
          disabled={state.creating}
        />
      </label>

      <nav className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={state.resetCreateForm} disabled={state.creating}>
          <X className="mr-1 h-4 w-4" />
          {t('header.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={!state.createNumber.trim() || state.creating}>
          {state.creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
          {t('header.save')}
        </Button>
      </nav>
    </form>
  );
}

interface ParkingEditRowProps {
  state: ReturnType<typeof useParkingTabState>;
  t: (key: string, options?: Record<string, string>) => string;
}

export function ParkingEditRow({ state, t }: ParkingEditRowProps) {
  return (
    <>
      <TableCell>
        <Input value={state.editNumber} onChange={(e) => state.setEditNumber(e.target.value)} className="h-8" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Select value={state.editType} onValueChange={(v) => state.setEditType(v as ParkingSpotType)} disabled={state.saving}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARKING_TYPES.map(pt => (<SelectItem key={pt} value={pt}>{t(`types.${pt}`)}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={state.editFloor} onChange={(e) => state.setEditFloor(e.target.value)} className="h-8 w-16" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" value={state.editArea} onChange={(e) => state.setEditArea(e.target.value)} className="h-8 w-16" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" value={state.editPrice} onChange={(e) => state.setEditPrice(e.target.value)} className="h-8 w-20" disabled={state.saving} />
      </TableCell>
      <TableCell>
        <Select value={state.editStatus} onValueChange={(v) => state.setEditStatus(v as ParkingSpotStatus)} disabled={state.saving}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PARKING_STATUSES.map(ps => (<SelectItem key={ps} value={ps}>{t(`status.${ps}`)}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <nav className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={state.handleSaveEdit} disabled={state.saving || !state.editNumber.trim()}>
            {state.saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />} {/* eslint-disable-line design-system/enforce-semantic-colors */}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={state.cancelEdit} disabled={state.saving}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </nav>
      </TableCell>
    </>
  );
}
