'use client';

/**
 * @fileoverview **Η ΣΤΗΛΗ ΤΟΥ ΘΟΛΩΜΑΤΟΣ** — πινέλο, «θόλωμα στο στόχαστρο», λίστα κύκλων με μέγεθος/αφαίρεση, «Εφαρμογή» σε δέσμη
 * (ADR-884 Φ2ζ ζ3 · §4.15, πρότυπα Matterport Blur Brush · Zillow «review and edit blurs»).
 * @related `useRedactionTool.ts` (η κατάσταση) · `TourRedactionOverlay.tsx` (πάνω στη φωτογραφία) · `TourArrowTools.tsx` (ίδια θέση,
 *   ίδιο ύφος)
 * @module components/spatial-tour/editor/redaction/TourRedactionTools
 *
 * ♿ **Το σύρσιμο ΔΕΝ είναι ο μόνος δρόμος** (WCAG 2.2 · 2.5.7): «Θόλωμα στο στόχαστρο» βάζει κύκλο στο κέντρο της εικόνας με ένα
 *   κλικ, το μέγεθος αλλάζει με ρυθμιστικό, η μετακίνηση με βελάκια πάνω στη λαβή.
 * 🔑 **Λέει την αλήθεια για το κόστος**: μετά την «Εφαρμογή» το σημείο ετοιμάζεται ξανά και οι επισκέπτες δεν το βλέπουν ως τότε
 *   (fail-closed ανά σημείο, Δ10.2) — ο υπεύθυνος το διαβάζει **πριν** πατήσει.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { MAX_TOUR_REDACTIONS, TOUR_REDACTION_MAX_RADIUS_RAD, TOUR_REDACTION_MIN_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { degToRad, radToDeg } from '@/lib/geometry/angle';
import { cn } from '@/lib/utils';
import { clampRedactionRadius, type TourDraftRedaction } from '@/lib/spatial-tour/tour-redaction-draft';

import { SPATIAL_TOUR_NS } from '../../spatial-tour-namespace';
import type { TourStageScene } from '../../viewer/TourPanoramaStage';
import { TOUR_REDACTION_KEYS } from '../tour-redaction-labels';
import type { RedactionTool } from './useRedactionTool';

/** Ο κύκλος του «θόλωμα στο στόχαστρο», ως κλάσμα του οπτικού πεδίου — ένα πρόσωπο σε μέση απόσταση. */
const RETICLE_RADIUS_OF_FOV = 0.08;
const MIN_DEG = radToDeg(TOUR_REDACTION_MIN_RADIUS_RAD);
const MAX_DEG = radToDeg(TOUR_REDACTION_MAX_RADIUS_RAD);

function RedactionRow({ item, number, tool }: { readonly item: TourDraftRedaction; readonly number: number; readonly tool: RedactionTool }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const selected = tool.draft.selectedId === item.id;
  const applied = tool.draft.applied.find((r) => r.id === item.id);
  const changed = applied === undefined || applied.yawRad !== item.yawRad || applied.pitchRad !== item.pitchRad || applied.radiusRad !== item.radiusRad;
  return (
    <li className="space-y-1 py-1 text-sm">
      <p className="m-0 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" aria-current={selected ? 'true' : undefined}
          className={cn('justify-start', selected && COLOR_BRIDGE.selectionControl.pressed)}
          onClick={() => tool.dispatch({ kind: 'select', id: selected ? null : item.id })}>
          {t(TOUR_REDACTION_KEYS.item, { number })}
        </Button>
        {item.source === 'auto' && <Badge variant="outline">{t(TOUR_REDACTION_KEYS.itemAuto)}</Badge>}
        {changed && <Badge variant="secondary">{t(TOUR_REDACTION_KEYS.itemDraft)}</Badge>}
        <Button type="button" variant="ghost" size="sm" onClick={() => tool.dispatch({ kind: 'remove', id: item.id })}>
          {t(TOUR_REDACTION_KEYS.remove, { number })}
        </Button>
      </p>
      <Slider value={[radToDeg(item.radiusRad)]} min={MIN_DEG} max={MAX_DEG} step={0.1}
        onValueChange={([deg]) => tool.dispatch({ kind: 'resize', id: item.id, radiusRad: degToRad(deg) })}
        thumbAriaLabel={t(TOUR_REDACTION_KEYS.size, { number })} className="w-full" />
    </li>
  );
}

function ApplyBar({ tool }: { readonly tool: RedactionTool }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const count = tool.edits.length;
  if (count === 0) return null;
  return (
    <footer className="space-y-2 rounded-md border p-2">
      <p className="m-0 text-sm text-muted-foreground">{t(TOUR_REDACTION_KEYS.applyNote)}</p>
      <p className="m-0 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={tool.applying} onClick={() => void tool.apply()}>
          {t(TOUR_REDACTION_KEYS.apply, { count })}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={tool.applying} onClick={() => tool.dispatch({ kind: 'discard' })}>
          {t(TOUR_REDACTION_KEYS.discard)}
        </Button>
      </p>
    </footer>
  );
}

export function TourRedactionTools({ tool, scene }: { readonly tool: RedactionTool; readonly scene: TourStageScene }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const { working, applied } = tool.draft;
  const removing = applied.filter((r) => !working.some((w) => w.id === r.id)).length;
  const atReticle = () => {
    const at = scene.centerPanorama();
    if (at === null) return;
    const radiusRad = clampRedactionRadius(scene.camera.get().view.fov * RETICLE_RADIUS_OF_FOV);
    tool.dispatch({ kind: 'add', id: tool.newId(), region: { yawRad: at.yaw, pitchRad: at.pitch, radiusRad } });
  };
  if (tool.captureId === null) return null;
  return (
    <section className="space-y-2" aria-labelledby="tour-redaction-heading">
      <h3 id="tour-redaction-heading" className="text-sm font-semibold">{t(TOUR_REDACTION_KEYS.title)}</h3>
      <p className="text-sm text-muted-foreground">{t(TOUR_REDACTION_KEYS.hint)}</p>
      <p className="m-0 flex flex-wrap gap-2">
        <Button type="button" variant={tool.brush ? 'default' : 'outline'} size="sm" aria-pressed={tool.brush}
          onClick={() => tool.setBrush(!tool.brush)}>{t(TOUR_REDACTION_KEYS.brush)}</Button>
        <Button type="button" variant="secondary" size="sm" disabled={working.length >= MAX_TOUR_REDACTIONS} onClick={atReticle}>
          {t(TOUR_REDACTION_KEYS.atReticle)}
        </Button>
      </p>
      {tool.brush && <p className="text-xs text-muted-foreground">{t(TOUR_REDACTION_KEYS.brushHint)}</p>}
      {working.length === 0
        ? <p className="text-sm text-muted-foreground">{t(TOUR_REDACTION_KEYS.empty)}</p>
        : (
          <ul className="m-0 list-none divide-y p-0">
            {working.map((item, i) => <RedactionRow key={item.id} item={item} number={i + 1} tool={tool} />)}
          </ul>
        )}
      {removing > 0 && <p className="text-sm text-muted-foreground">{t(TOUR_REDACTION_KEYS.removing, { count: removing })}</p>}
      <ApplyBar tool={tool} />
    </section>
  );
}
