'use client';

/**
 * @fileoverview 📍 **Η κάρτα «Θέση στον χάρτη»** — σε ποιο σύστημα είναι οι συντεταγμένες, και αν το κοινό βλέπει τη θέση (ADR-920 §14.12 φάση Α).
 * @related hooks/listings/useTerrainGeoreference (κατάσταση + πράξεις) · ./TerrainLocationVisibilityCheckbox (η συγκατάθεση) ·
 *   lib/terrain/publication/terrain-georeference-declaration (ο ΕΝΑΣ κριτής — ό,τι δείχνει η κάρτα, αυτό επιβάλλει η πόρτα)
 * @module components/terrain/georeference/TerrainGeoreferenceCard
 *
 * 🔑 **Το σύστημα δηλώνεται, δεν μαντεύεται** (Civil 3D `GEOCSASSIGN` · QGIS «prompt for CRS»): η κάρτα λέει τι δείχνουν τα
 *    σημεία και τι θα έδινε η ανάγνωσή τους ως ΕΓΣΑ '87 — **πριν** δηλώσει ο άνθρωπος. Η επιλογή μένει δική του.
 * 🔑 **Δύο ερωτήσεις, δύο ονομασμένες ομάδες με διαχωριστικό**: «σε ποιο σύστημα;» (ραδιόφωνα) και «στη δημόσια αγγελία»
 *    (κουτάκι) — Airbnb: η διεύθυνση και η κοινοποίηση θέσης είναι χωριστές ενότητες. Το κουτάκι μένει ανενεργό μέχρι να
 *    δηλωθεί ΕΓΣΑ '87 και **λέει γιατί** — χωρίς σύστημα δεν υπάρχει θέση να φανεί.
 * ♿ Η ζωντανή περιοχή μένει πάντα στο DOM, για να ανακοινώνεται η έκβαση κάθε πράξης.
 */

import React, { useId } from 'react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import type { TerrainGeoreferenceApi } from '@/hooks/listings/useTerrainGeoreference';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { TERRAIN_COORDINATE_SYSTEMS } from '@/lib/terrain/publication/listing-terrain-source';
import type { TerrainCoordinateSystem } from '@/lib/terrain/publication/listing-terrain-types';
import type { GreekGridReading, TerrainGeoreferenceStatus } from '@/lib/terrain/publication/terrain-georeference-declaration';
import { TERRAIN_REFUSAL_MESSAGE_LIMITS } from '@/lib/terrain/publication/terrain-publication-contract';

import { TerrainLocationVisibilityCheckbox } from './TerrainLocationVisibilityCheckbox';

const NS = 'terrain-survey:georeference';
const [GREEK_GRID, LOCAL] = TERRAIN_COORDINATE_SYSTEMS;
/** Το κλειδί μετάφρασης κάθε συστήματος — `Record` ώστε τρίτο σύστημα να μη μεταγλωττίζεται χωρίς ετικέτα. */
const SYSTEM_KEY: Readonly<Record<TerrainCoordinateSystem, string>> = { [GREEK_GRID]: 'greekGrid', [LOCAL]: 'local' };

function isCoordinateSystem(value: string): value is TerrainCoordinateSystem {
  return value === GREEK_GRID || value === LOCAL;
}

const whole = (metres: number) => formatNumber(metres, { maximumFractionDigits: 0 });

/** Ο τίτλος κάθε ομάδας της κάρτας — ίδιος και για τις δύο, ώστε να διαβάζονται ως δύο **ισότιμες** ερωτήσεις. */
const GROUP_LEGEND = 'p-0 text-sm font-medium text-foreground';

/** Τι θα έδινε η ανάγνωση ως ΕΓΣΑ '87 — με τους μετρημένους αριθμούς, όχι σκέτο «σωστό / λάθος». */
function ReadingLine({ reading }: { readonly reading: GreekGridReading }) {
  const { t } = useTranslation(['terrain-survey']);
  const values = 'distanceM' in reading ? { distance: whole(reading.distanceM), tolerance: whole(reading.toleranceM) } : {};
  return (
    <p className="m-0 text-sm text-muted-foreground" data-greek-grid-reading={reading.kind}>
      {t(`${NS}.reading.${reading.kind}`, values)}
    </p>
  );
}

function SystemChoice({ api, status, busy }: {
  readonly api: TerrainGeoreferenceApi;
  readonly status: TerrainGeoreferenceStatus;
  readonly busy: boolean;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const groupId = useId();
  const greekGridHolds = status.greekGrid.kind === 'agrees';
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className={GROUP_LEGEND}>{t(`${NS}.system.question`)}</legend>
      {status.suggestion !== null && (
        <p className="m-0 text-xs text-muted-foreground">{t(`${NS}.system.suggestion.${SYSTEM_KEY[status.suggestion]}`)}</p>
      )}
      <RadioGroup value={status.coordinateSystem ?? ''} disabled={busy} aria-label={t(`${NS}.system.question`)}
        onValueChange={(value) => { if (isCoordinateSystem(value)) void api.amend({ kind: 'coordinate-system', system: value }); }}>
        {TERRAIN_COORDINATE_SYSTEMS.map((system) => (
          <span key={system} className="flex items-center gap-2">
            {/* Η πόρτα θα αρνιόταν ούτως ή άλλως· ο λόγος είναι γραμμένος ακριβώς από πάνω (ReadingLine). */}
            <RadioGroupItem id={`${groupId}-${system}`} value={system} disabled={busy || (system === GREEK_GRID && !greekGridHolds)} />
            <Label htmlFor={`${groupId}-${system}`} className="text-sm font-normal">{t(`${NS}.system.${SYSTEM_KEY[system]}`)}</Label>
          </span>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/**
 * **Η δεύτερη ερώτηση, σε δική της ονομασμένη ομάδα**: «τι βλέπει το κοινό;». Ως τις 2026-11-24 το κουτάκι καθόταν ακριβώς
 * κάτω από τα δύο ραδιόφωνα, χωρίς τίποτα ανάμεσα — διαβαζόταν ως **τρίτη επιλογή συστήματος** (ζωντανός έλεγχος `2cc1dc01`).
 */
function AudienceChoice({ api, status, busy }: {
  readonly api: TerrainGeoreferenceApi;
  readonly status: TerrainGeoreferenceStatus;
  readonly busy: boolean;
}) {
  const { t } = useTranslation(['terrain-survey']);
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" data-georeference-audience="">
      <legend className={GROUP_LEGEND}>{t(`${NS}.audience.heading`)}</legend>
      <TerrainLocationVisibilityCheckbox checked={status.showLocationInListing}
        systemDeclared={status.coordinateSystem === GREEK_GRID} busy={busy}
        onChange={(showInListing) => void api.amend({ kind: 'location-visibility', showInListing })} />
    </fieldset>
  );
}

function ActionMessage({ api }: { readonly api: TerrainGeoreferenceApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const { action } = api;
  const text = action.kind === 'done' ? t(`${NS}.done.${action.changed ? 'changed' : 'unchanged'}`)
    : action.kind === 'refused' ? t(`terrain-survey:publish.refusals.${action.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS) : '';
  return <p role="status" className="m-0 text-sm text-foreground">{text}</p>;
}

export function TerrainGeoreferenceCard({ api }: { readonly api: TerrainGeoreferenceApi }) {
  const { t } = useTranslation(['terrain-survey']);
  const headingId = useId();
  const { view } = api;
  // Χωρίς ανάγλυφο δεν υπάρχουν συντεταγμένες να δηλωθούν: η κάρτα δεν εμφανίζεται καθόλου.
  if (view.kind === 'ready' && view.georeference === null) return null;
  const busy = api.action.kind === 'acting';
  return (
    <section aria-labelledby={headingId} aria-busy={view.kind === 'loading'} data-terrain-georeference=""
      className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(`${NS}.heading`)}</h4>
      {view.kind === 'loading' && <p role="status" className="m-0 text-sm text-muted-foreground">{t(`${NS}.loading`)}</p>}
      {view.kind === 'failed' && (
        <p role="alert" className="m-0 text-sm text-foreground">
          {t(`terrain-survey:publish.refusals.${view.refusal}`, TERRAIN_REFUSAL_MESSAGE_LIMITS)}
        </p>
      )}
      {view.kind === 'ready' && view.georeference !== null && (
        <>
          <ReadingLine reading={view.georeference.greekGrid} />
          <SystemChoice api={api} status={view.georeference} busy={busy} />
          <Separator />
          <AudienceChoice api={api} status={view.georeference} busy={busy} />
        </>
      )}
      <ActionMessage api={api} />
    </section>
  );
}
