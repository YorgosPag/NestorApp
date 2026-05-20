"use client";

/**
 * BimEntityCardPanel — right-side entity detail panel for the 3D viewport.
 *
 * ADR-040 micro-leaf: subscribes ONLY to Selection3DStore (1 useSyncExternalStore).
 * Entity data read once from Bim3DEntitiesStore.getState() — no second subscription.
 * Closes on X button or click on empty 3D space (selectBimEntity(null) from BimViewport3D).
 *
 * Absolute-positioned inside the viewport div (NOT portal/fixed) → z-[60].
 * ADR-366 B.2.Q4.
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Square, Columns, Minus, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { BimGeometryTab } from './tabs/BimGeometryTab';
import { BimAuditTab } from './tabs/BimAuditTab';

const ENTITY_ICONS: Record<string, LucideIcon> = {
  wall: Square,
  column: Columns,
  beam: Minus,
  slab: LayoutGrid,
};

export function BimEntityCardPanel() {
  const { t } = useTranslation('bim3d');

  const state = useSyncExternalStore(
    useSelection3DStore.subscribe,
    useSelection3DStore.getState,
    useSelection3DStore.getState,
  );

  const { selectedBimId, selectedBimType } = state;
  if (!selectedBimId || !selectedBimType) return null;

  const Icon = ENTITY_ICONS[selectedBimType] ?? Square;
  const title = t(`entityTypes.${selectedBimType}`);

  function handleClose() {
    useSelection3DStore.getState().clearSelection();
  }

  return (
    <aside
      className="absolute right-0 top-0 bottom-0 z-[60] flex w-80 flex-col overflow-hidden border-l border-border bg-background/95 backdrop-blur-sm"
      aria-label={title}
    >
      <div className="relative flex-shrink-0">
        <EntityDetailsHeader
          icon={Icon}
          title={title}
          subtitle={selectedBimId}
          variant="compact"
        />
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-2 top-2 h-7 w-7"
          aria-label={t('entityCard.closeAria')}
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="geometry" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 h-8 flex-shrink-0">
          <TabsTrigger value="geometry" className="flex-1 text-xs">
            {t('entityCard.tabs.geometry')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 text-xs">
            {t('entityCard.tabs.audit')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geometry" className="flex-1 overflow-y-auto">
          <BimGeometryTab bimId={selectedBimId} bimType={selectedBimType} />
        </TabsContent>

        <TabsContent value="audit" className="flex-1 overflow-y-auto">
          <BimAuditTab bimId={selectedBimId} bimType={selectedBimType} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
