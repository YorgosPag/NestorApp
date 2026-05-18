'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EventBus } from '../systems/events/EventBus';
import { getAllLayers, upsertLayer } from '../stores/LayerStore';
import { createSceneLayer } from '../types/entities';
import { getIsoLinetype } from '../config/linetype-iso-catalog';
import { LINEWEIGHT_SPECIAL } from '../config/lineweight-iso-catalog';
import { hasConstructionLayer } from '../services/construction-layer-detector';

const DISMISSED_KEY = 'dxf:constructionLayerDismissed';

function useConstructionLayerScaffoldState() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return EventBus.on('drawing:complete', ({ tool }) => {
      if (tool !== 'xline') return;
      if (localStorage.getItem(DISMISSED_KEY) === '1') return;
      if (hasConstructionLayer(getAllLayers())) return;
      setOpen(true);
    });
  }, []);

  const handleCreate = useCallback(() => {
    const layer = createSceneLayer({
      name: 'Construction',
      color: '#00FFFF',
      colorAci: 4,
      colorTrueColor: null,
      linetype: getIsoLinetype('Dashed')?.name ?? 'Continuous',
      lineweight: LINEWEIGHT_SPECIAL.DEFAULT,
      plottable: false,
      category: 'general',
      source: 'user-created',
    });
    upsertLayer(layer);
    setOpen(false);
  }, []);

  const handleSkip = useCallback(() => {
    setOpen(false);
  }, []);

  const handleNeverAsk = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setOpen(false);
  }, []);

  return { open, setOpen, handleCreate, handleSkip, handleNeverAsk };
}

export function ConstructionLayerScaffoldDialog() {
  const { t } = useTranslation(['dxf-viewer']);
  const { open, setOpen, handleCreate, handleSkip, handleNeverAsk } =
    useConstructionLayerScaffoldState();

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) handleSkip(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('tools.constructionLayerScaffold.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('tools.constructionLayerScaffold.body')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleNeverAsk}>
            {t('tools.constructionLayerScaffold.neverAsk')}
          </AlertDialogCancel>
          <AlertDialogCancel onClick={handleSkip}>
            {t('tools.constructionLayerScaffold.skip')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate}>
            {t('tools.constructionLayerScaffold.create')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
