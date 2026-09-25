'use client';

/**
 * **Ζ4 — «μόνο αυτά τα κομμάτια»**: η σχεδιασμένη περιοχή της ζήτησης, με **πολλά** σχήματα (ADR-888).
 *
 * 🔑 **Η ίδια γεωμετρία με τον χάρτη αποτελεσμάτων (ADR-885)**: ως `MAX_DRAWN_SHAPES` σχήματα, μέσα σε
 * οποιοδήποτε = μέσα. Ό,τι σώζεται από τον χάρτη ανοίγει εδώ αυτούσιο, και αντίστροφα.
 *
 * ⚠️ **Το τρέχον πρόχειρο μετρά ΧΩΡΙΣ «Νέο σχήμα»** — ο άνθρωπος με ένα σχήμα δεν χρειάζεται να πατήσει
 * τίποτα παραπάνω από πριν. Το «Νέο σχήμα» απλώς το κλειδώνει και ανοίγει καθαρό πρόχειρο.
 *
 * ⚠️ **Ανεβάζει μόνο ΕΓΚΥΡΑ σχήματα**: ημιτελές πρόχειρο δεν ανεβαίνει, άρα ο φραγμός υποβολής
 * (`area-not-drawn`) μένει αληθινός.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PlaceMap } from '@/components/geo/PlaceMap';
import { OutlineDraftControls, useOutlineDraft } from '@/components/geo/outline-draft';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { vertexCentroid } from '@/lib/geo/geo-ring';
import { MAX_DRAWN_SHAPES } from '@/lib/listings/listing-drawn-area';
import type { GeoOutline } from '@/types/geo/coordinates';

const NS = 'search-results';
const DRAW_NS = 'search-region';

export interface DemandAreaOutlineProps {
  /** Τα σχήματα με τα οποία ανοίγει (επεξεργασία ή προσυμπλήρωση από τον χάρτη). */
  readonly shapes: readonly GeoOutline[];
  readonly onShapesChange: (shapes: GeoOutline[]) => void;
}

/** Η κατάσταση των σχημάτων: κλειδωμένα + ένα πρόχειρο· ανεβάζει πάντα τα **έγκυρα**. */
function useDemandAreaShapes(initial: readonly GeoOutline[], onShapesChange: (shapes: GeoOutline[]) => void) {
  const [committed, setCommitted] = useState<readonly GeoOutline[]>(initial);
  const draft = useOutlineDraft(null);

  const all = useMemo(
    () => (draft.outline === null ? [...committed] : [...committed, draft.outline]),
    [committed, draft.outline],
  );

  useEffect(() => {
    onShapesChange(all);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ο γονέας κρατά νέα ταυτότητα callback ανά απόδοση
  }, [all]);

  const commitDraft = (): void => {
    const outline = draft.outline;
    if (outline === null) return;
    setCommitted((current) => [...current, outline]);
    draft.clear();
  };
  const removeShape = (index: number): void => {
    setCommitted((current) => current.filter((_, at) => at !== index));
  };

  return { committed, draft, count: all.length, commitDraft, removeShape };
}

export function DemandAreaOutline({ shapes, onShapesChange }: DemandAreaOutlineProps): React.ReactElement {
  const { t } = useTranslation([NS, DRAW_NS]);
  const area = useDemandAreaShapes(shapes, onShapesChange);
  const { committed, draft } = area;
  const full = area.count >= MAX_DRAWN_SHAPES;

  const vertices = [...committed.flat(), ...draft.vertices];
  const center =
    vertices.length > 0
      ? vertexCentroid(vertices)
      : { lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE, lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE };

  return (
    <section className="space-y-2">
      <p className="text-sm text-muted-foreground">{t(`${NS}:place.modeHint.draw`)}</p>
      <PlaceMap
        center={center}
        onPick={full && draft.vertices.length === 0 ? undefined : draft.addVertex}
        shapes={committed}
        trace={draft.vertices}
        outline={draft.outline}
      />
      <p className="text-xs text-muted-foreground">{t(`${NS}:place.attribution`)}</p>
      <OutlineDraftControls draft={draft} />
      <footer className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t(`${DRAW_NS}:draw.shapes`, { count: area.count })}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={area.commitDraft}
          disabled={draft.outline === null || full}
        >
          <Plus className="mr-2 size-4" aria-hidden />
          {t(`${DRAW_NS}:draw.addShape`)}
        </Button>
        {full && <span className="text-sm text-muted-foreground">{t(`${DRAW_NS}:draw.full`)}</span>}
      </footer>
      <DemandAreaShapeList shapes={committed} onRemove={area.removeShape} />
    </section>
  );
}

/** Τα κλειδωμένα σχήματα — ένα κουμπί αφαίρεσης το καθένα, αριθμημένα όπως στον χάρτη αποτελεσμάτων. */
function DemandAreaShapeList({
  shapes,
  onRemove,
}: {
  readonly shapes: readonly GeoOutline[];
  readonly onRemove: (index: number) => void;
}): React.ReactElement | null {
  const { t } = useTranslation([DRAW_NS]);
  if (shapes.length === 0) return null;
  return (
    <ol className="flex flex-wrap gap-2">
      {shapes.map((shape, index) => (
        <li key={`${shape[0]?.lat}:${shape[0]?.lng}:${index}`}>
          <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)}>
            <X className="mr-1 size-4" aria-hidden />
            {t(`${DRAW_NS}:draw.removeShape`, { index: index + 1 })}
          </Button>
        </li>
      ))}
    </ol>
  );
}
