'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { StorageUnit } from '@/types/storage';

interface StorageFormFooterProps {
  onCancel: () => void;
  unit: StorageUnit | null;
}

export function StorageFormFooter({ onCancel, unit }: StorageFormFooterProps) {
  const iconSizes = useIconSizes();
  return (
    <div className="p-6 border-t bg-muted/30 sticky bottom-0">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          * Υποχρεωτικά πεδία
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Ακύρωση
          </Button>
          <Button type="submit">
            <Save className={`${iconSizes.sm} mr-2`} />
            {unit ? 'Ενημέρωση' : 'Αποθήκευση'}
          </Button>
        </div>
      </div>
    </div>
  );
}
