'use client';

/**
 * **Ο χάρτης της σελίδας περιοχής ανά επίπεδο ιεραρχίας** (ADR-890 §15 · §16) — ο ιδιοκτήτης της κατάστασης που
 * μοιράζονται ο χάρτης, το πάνελ του και ο πίνακας των παιδιών από κάτω.
 *
 * 🔑 **Το επίπεδο αποφασίζει τον χάρτη** (idealista: κάθε επίπεδο βάφει τα **παιδιά** του, κλικ ⇒ κάθοδος):
 *   - **Περιφέρεια / Π.Ε. με ≥ 2 παιδιά**: μόνο ο χωροπληθής των Π.Ε. / των Δήμων + πίνακας — καμία ζώνη (χιλιάδες).
 *   - **Δήμος με ≥ 2 Δ.Ε.**: χωροπληθής των Δ.Ε. (προεπιλογή) + πίνακας με τιμές · οι ζώνες ένα κλικ μακριά.
 *   - **Δ.Ε. / Δήμος χωρίς Δ.Ε.**: το όριο + οι ζώνες, όπως πριν.
 * 🔑 **Χωρίς τιμές παιδιών** (δεν διαβάστηκαν) η σελίδα πέφτει τίμια στο παλιό: όριο (+ ζώνες) και τα παιδιά ως
 *   σύνδεσμοι στο τέλος της σελίδας (`AreaMarketContent`).
 */

import React, { useMemo, useState } from 'react';

import { PRICE_MAP_WORD_NAMESPACES, usePriceMapLabelText } from '@/components/market/choropleth/price-map-words';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { AreaMarketPageData } from '@/types/area-market';

import type { AreaMapMode } from './area-children-view';
import { AreaBoundaryMap, type AreaPriceMapSlot } from './AreaBoundaryMap';
import { AreaChildPriceLayer } from './AreaChildPriceLayer';
import { AreaChildPricePanel } from './AreaChildPricePanel';
import { AreaChildrenTable } from './AreaChildrenTable';
import { useAreaChildMap, type AreaChildMapModel } from './useAreaChildMap';

/**
 * Το κείμενο της ετικέτας πάνω σε ένα παιδί: η τιμή του · «<γονέας>: τιμή» · «λίγα συμβόλαια» (κοινοί κανόνες:
 * `usePriceMapLabelText`). Λίγα παιδιά ⇒ το «λίγα» γράφεται: λέει κάτι, και δεν πνίγει τον χάρτη (ADR-890 §18).
 */
function useLabelText(model: AreaChildMapModel | null) {
  const { t } = useTranslation([...PRICE_MAP_WORD_NAMESPACES]);
  // Σταθερές εξαρτήσεις (`choice`/`words` είναι memo του μοντέλου) — το ίδιο το μοντέλο είναι νέο σε κάθε απόδοση.
  return usePriceMapLabelText(model?.choice ?? null, model?.words.parentLabel ?? null, t('area-market:childMap.fewLabel'));
}

function usePriceSlot(model: AreaChildMapModel | null): AreaPriceMapSlot | null {
  const labelText = useLabelText(model);
  return useMemo(() => {
    if (model === null) return null;
    const file = model.geometry === null || model.geometry === 'unavailable' ? null : model.geometry;
    return {
      layer: file === null ? null : <AreaChildPriceLayer model={model} file={file} labelText={labelText} />,
      panel: <AreaChildPricePanel model={model} />,
      label: model.words.prices,
    };
  }, [labelText, model]);
}

/** Χάρτης + (όπου υπάρχει χάρτης σύγκρισης) ο πίνακας των παιδιών ακριβώς από κάτω. */
export function AreaMapSection({ data }: { readonly data: AreaMarketPageData }) {
  const [mode, setMode] = useState<AreaMapMode>('prices');
  const model = useAreaChildMap(data, mode === 'prices');
  const prices = usePriceSlot(model);
  return (
    <>
      <AreaBoundaryMap areaId={data.area.id} valueZoneFiles={data.valueZoneFiles} prices={prices} mode={mode} onModeChange={setMode} />
      {model !== null && <AreaChildrenTable model={model} />}
    </>
  );
}
