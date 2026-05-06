/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';

interface BuildingSpaceWarningBannerProps {
  title: string;
  hint: string;
  addLabel: string;
  onAdd: () => void;
}

export function BuildingSpaceWarningBanner({ title, hint, addLabel, onAdd }: BuildingSpaceWarningBannerProps) {
  const iconSizes = useIconSizes();

  return (
    <section className="text-center py-8 border-2 border-dashed rounded-lg border-amber-500">
      <AlertTriangle className={`${iconSizes.xl} mx-auto mb-2 text-amber-500`} />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm mb-3 text-amber-500">{hint}</p>
      <Button variant="default" size="sm" onClick={onAdd}>
        <Plus className={`${iconSizes.sm} mr-2`} />
        {addLabel}
      </Button>
    </section>
  );
}
