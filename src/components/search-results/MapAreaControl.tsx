'use client';

/**
 * # ΤΑ ΧΕΙΡΙΣΤΗΡΙΑ ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ — ΔΥΟ ΘΕΣΕΙΣ, ΟΧΙ ΜΙΑ ΣΤΟΙΒΑ (ADR-777 §8.63 · §8.85)
 *
 * 🔴 **Ήταν μία κεντραρισμένη στήλη** (διακόπτης · «Σχεδίαση» · «Αποθήκευση» · «Τιμές €/τ.μ.»)
 * ακριβώς εκεί που κοιτάζει ο άνθρωπος (στιγμιότυπο του Giorgio, 2026-10-02). Τώρα κάθε
 * χειριστήριο ζει στη **θέση του ρόλου του** (`MAP_OVERLAY_SLOT`):
 *
 * | Θέση | Τι |
 * |---|---|
 * | `status` (πάνω κέντρο) | **ΕΝΑ** στοιχείο: το chip ορίου/σχεδίου/σχεδίασης, **ή** το χάπι «Αναζήτηση εδώ │ διακόπτης» |
 * | `tools` (δεξί άκρο) | μπάρα εικονιδίων: Σχεδίαση · Στρώσεις |
 *
 * Η «Αποθήκευση αναζήτησης» **έφυγε από τον χάρτη** — στη γραμμή φίλτρων (Zillow / Redfin).
 *
 * 🔑 **Το κουμπί «Αναζήτηση εδώ» μπαίνει ΜΕΣΑ στο χάπι του διακόπτη**, όχι από πάνω του. Η Airbnb
 * **αντικαθιστά** το checkbox με το κουμπί· εδώ ο διακόπτης **μένει**, γιατί ένα χειριστήριο που
 * εξαφανίζεται αφήνει τον άνθρωπο χωρίς ορατή έξοδο από μια συμπεριφορά. Η ορατότητα του κουμπιού
 * είναι **δομικά** δεμένη με το `pendingArea` — καμία δεύτερη σημαία `showButton`.
 *
 * ⚠️ **Με όριο (δήμου ή σχεδιασμένο) ο διακόπτης ΔΕΝ δείχνεται**: η κίνηση του χάρτη δεν αλλάζει
 * τότε την περιοχή, άρα θα υποσχόταν κάτι που δεν κάνει (ADR-883).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { cn } from '@/lib/utils';
import { MAP_OVERLAY_INTERACTIVE, MAP_OVERLAY_SLOT } from '@/subapps/geo-canvas/components/map-overlays/map-overlay-slots';
import { MapToolbar } from '@/subapps/geo-canvas/components/map-overlays/MapToolbar';

interface MapAreaControlProps {
  readonly followMap: boolean;
  readonly onFollowMapChange: (next: boolean) => void;
  /** Υπάρχει κάδρο που δεν έχει ζητηθεί ακόμη; Ορίζει **αν** εμφανίζεται το κουμπί. */
  readonly hasPendingArea: boolean;
  readonly onSearchHere: () => void;
  /** Chip ορίου / σχεδίου / ζώνη σχεδίασης *(ADR-883 · ADR-885)* — παίρνει τη θέση του χαπιού. */
  readonly regionChip?: React.ReactNode;
  /** ADR-885 — «Σχεδίαση», `MapToolbarButton`. Ο καταναλωτής το δίνει `null` όσο υπάρχει chip. */
  readonly drawButton?: React.ReactNode;
  /** ADR-890 §14 — στρώσεις (χάρτης τιμών), `MapToolbarButton`. Ρύθμιση προβολής ⇒ τελευταίο. */
  readonly layerControl?: React.ReactNode;
}

const SWITCH_ID = 'search-results-follow-map';

interface FollowMapPillProps {
  readonly followMap: boolean;
  readonly onFollowMapChange: (next: boolean) => void;
  readonly hasPendingArea: boolean;
  readonly onSearchHere: () => void;
}

/** «Αναζήτηση εδώ │ ⚪ Αναζήτηση καθώς μετακινώ» — ΕΝΑ χάπι, το εφήμερο μπροστά, το μόνιμο πίσω. */
function FollowMapPill({ followMap, onFollowMapChange, hasPendingArea, onSearchHere }: FollowMapPillProps) {
  const { t } = useTranslation(['search-results']);
  return (
    <section
      aria-label={t('search-results:area.followMap')}
      className={cn(
        MAP_OVERLAY_INTERACTIVE,
        'flex max-w-full items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 shadow-md',
        hasPendingArea ? 'pl-1' : 'pl-3'
      )}
    >
      {hasPendingArea && (
        <>
          {/*
            🔴 `COLOR_BRIDGE.action.primary`, ΟΧΙ το προεπιλεγμένο `Button`: εκείνο είναι `bg-primary`, που στο
            σκοτεινό θέμα ≡ `--card` (ADR-770 §18.7) — μέσα σε χάπι `bg-card` το κουμπί θα χανόταν (βρέθηκε ζωντανά).
          */}
          <Button
            type="button"
            size="sm"
            onClick={onSearchHere}
            className={cn('shrink-0 rounded-full', COLOR_BRIDGE.action.primary)}
          >
            {t('search-results:area.searchHere')}
          </Button>
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
        </>
      )}
      <Switch id={SWITCH_ID} checked={followMap} onCheckedChange={onFollowMapChange} />
      {/*
        ⚠️ `<label htmlFor>`, όχι `<span>`: το κείμενο γίνεται στόχος κλικ (WCAG 2.5.5).
        📱 Στο στενό, με κουμπί δίπλα, η ετικέτα γίνεται `sr-only` — ο διακόπτης μένει ορατός και ονομασμένος.
      */}
      <label
        htmlFor={SWITCH_ID}
        className={cn('min-w-0 cursor-pointer truncate text-sm text-foreground', hasPendingArea && 'max-md:sr-only')}
      >
        {t('search-results:area.followMap')}
      </label>
    </section>
  );
}

export function MapAreaControl({
  followMap,
  onFollowMapChange,
  hasPendingArea,
  onSearchHere,
  regionChip,
  drawButton,
  layerControl,
}: MapAreaControlProps) {
  const { t } = useTranslation(['search-results']);
  const hasTools = Boolean(drawButton) || Boolean(layerControl);

  return (
    <>
      <div className={MAP_OVERLAY_SLOT.status}>
        {regionChip ?? (
          <FollowMapPill
            followMap={followMap}
            onFollowMapChange={onFollowMapChange}
            hasPendingArea={hasPendingArea}
            onSearchHere={onSearchHere}
          />
        )}
      </div>
      {hasTools && (
        <MapToolbar label={t('search-results:area.tools')}>
          {drawButton}
          {layerControl}
        </MapToolbar>
      )}
    </>
  );
}
