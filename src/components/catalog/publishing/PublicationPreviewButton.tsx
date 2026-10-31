'use client';

/**
 * @fileoverview **«Προεπισκόπηση εκτύπωσης»** — μία σελίδα του μοντέλου όπως θα τυπωθεί (ADR-923 §5.6.1).
 * @related services/catalog/catalog-publishing-api.client.ts (η προεπισκόπηση) · products/variants/ModelTablePreview.tsx (πού ζει)
 * @module components/catalog/publishing/PublicationPreviewButton
 *
 * 🔑 **Οκνηρή (lazy) ανάγνωση**: ο εκδότης ρωτιέται μόνο όταν ο άνθρωπος πατήσει το κουμπί, όχι σε κάθε άνοιγμα του μοντέλου.
 * 🔒 Η προεπισκόπηση **δεν** φέρει τιμές (ο διακομιστής τις αφαιρεί): δικαιοδοσία `products`, όχι `pricing`. Γι' αυτό εδώ **δεν**
 *    διαβάζουμε συνταγές (κριτής `pricingView`): τη συνταγή τη διαλέγει ο διακομιστής.
 * 🔑 Αδύνατη προεπισκόπηση ⇒ **ένα** μήνυμα (`publishing.preview.unavailable`), ποτέ σιωπή ή ωμό σφάλμα μηχανής. Η ακριβής αιτία
 *    ανήκει στη σελίδα εκδόσεων: εδώ θα έφερνε ολόκληρη την οικογένεια `publishing.failure.*` στο slice της σελίδας προϊόντων (CHECK 3.34).
 */

import React, { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { catalogFailureOf } from '@/services/catalog/catalog-failure';
import { fetchPublicationPreview } from '@/services/catalog/catalog-publishing-api.client';
import { useCatalogFailureNotice, useCatalogText } from '../shared/catalog-ui-hooks';

type PreviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'noRecipe' }
  | { readonly kind: 'ready'; readonly pngBase64: string }
  | { readonly kind: 'unavailable' };

const IDLE: PreviewState = { kind: 'idle' };

async function loadPreview(modelId: string): Promise<PreviewState> {
  const result = await fetchPublicationPreview(modelId);
  if (result.status === 'noRecipe') return { kind: 'noRecipe' };
  return result.status === 'ready' ? { kind: 'ready', pngBase64: result.pngBase64 } : { kind: 'unavailable' };
}

export function PublicationPreviewButton({ modelId }: { readonly modelId: string }) {
  const { t } = useCatalogText();
  const notifyFailure = useCatalogFailureNotice();
  const [state, setState] = useState<PreviewState>(IDLE);
  const show = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      setState(await loadPreview(modelId));
    } catch (cause) {
      setState(IDLE);
      notifyFailure(catalogFailureOf(cause));
    }
  }, [modelId, notifyFailure]);
  return (
    <section className="flex flex-col gap-2" aria-label={t('publishing.preview.title')}>
      <p className="m-0">
        <Button type="button" variant="outline" disabled={state.kind === 'loading'} onClick={() => { void show(); }}>
          {t('publishing.preview.show')}
        </Button>
      </p>
      {state.kind === 'noRecipe' ? <p className="m-0 text-sm text-muted-foreground" role="status">{t('publishing.preview.noRecipe')}</p> : null}
      {state.kind === 'unavailable' ? <p className="m-0 text-sm text-destructive" role="alert">{t('publishing.preview.unavailable')}</p> : null}
      {state.kind === 'ready' ? (
        <img className="max-w-full rounded-md border" src={`data:image/png;base64,${state.pngBase64}`} alt={t('publishing.preview.alt')} />
      ) : null}
    </section>
  );
}
