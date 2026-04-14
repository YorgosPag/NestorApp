'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Pencil, Unlink2, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { StorageUnit } from '@/types/storage';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface StorageRowActionsProps {
  unit: StorageUnit;
  onEdit: (unit: StorageUnit) => void;
  onDelete: (propertyId: string) => void;
  deletingId?: string | null;
  unlinkingId?: string | null;
  onUnlink?: (unit: StorageUnit) => void;
}

export function StorageRowActions({ unit, onEdit, onDelete, deletingId, unlinkingId, onUnlink }: StorageRowActionsProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  return (
    <nav className="flex justify-end gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.view')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(unit)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.edit')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-amber-600 hover:text-amber-700"
            onClick={() => onUnlink?.(unit)}
            disabled={unlinkingId === unit.id}
          >
            {unlinkingId === unit.id ? <Spinner size="small" color="inherit" /> : <Unlink2 className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.unlink')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(unit.id)}
            disabled={deletingId === unit.id}
          >
            {deletingId === unit.id ? <Spinner size="small" color="inherit" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('spaceActions.delete')}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
