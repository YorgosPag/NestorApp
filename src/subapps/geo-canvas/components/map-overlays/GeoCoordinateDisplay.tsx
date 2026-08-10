/**
 * 🌍 **ΤΟ ΠΑΝΕΛ ΤΟΥ ΥΠΟΒΑΘΡΟΥ** — διακόπτης χάρτη, και (μόνο για εργαλεία) συντεταγμένες.
 *
 * @related ADR-777 §2.2 (απόφαση Giorgio) · Α8 · config/map-chrome.ts
 * @module GeoCoordinateDisplay
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΤΟ ΞΑΝΑΓΡΑΨΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το component αποδιδόταν **χωρίς καμία συνθήκη** (`InteractiveMapContainer:393`),
 * ενώ ο γείτονάς του `GeoMapControls` φρουρούνταν από `showMapControls`. Άρα ο
 * `showMapControls={false}` του δημόσιου χάρτη έκρυβε **το ένα από τα δύο** πάνελ, και
 * ο επισκέπτης που έψαχνε σπίτι έβλεπε **γεωγραφικό μήκος, πλάτος, υψόμετρο και επτά
 * στυλ χάρτη**. ⚠️ Και το σχόλιο του `InteractiveMap.tsx:43` έλεγε ότι το
 * `showMapControls` κρύβει «*coordinate picker & **style selector***» — **ψευδές**:
 * ο άλλος επιλογέας στυλ ήταν **εδώ**, ακυβέρνητος. *Ένα σχόλιο που δηλώνει κάλυψη
 * δεν είναι κάλυψη.*
 *
 * **Πλέον τίποτα δεν αποφασίζεται εδώ**: όλα έρχονται από το ονομασμένο ακροατήριο
 * ({@link MAP_CHROME}), ώστε το επόμενο overlay να μην μπορεί να διαρρεύσει σιωπηλά.
 */

'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import type { GeoCoordinate } from '../../types';
import type { MapStyleType } from '../../services/map/MapStyleManager';
import { MAP_STYLE_CATALOG, type BasemapChoice, type MapChromeCapabilities } from '../../config/map-chrome';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MAP_OVERLAY_SURFACE } from './overlay-surface';

// ============================================================================
// 🎯 ΣΥΜΒΟΛΑΙΟ
// ============================================================================

export interface GeoCoordinateDisplayProps {
  /** Τρέχουσα συντεταγμένη κάτω από τον δείκτη. */
  hoveredCoordinate: GeoCoordinate | null;

  /** Το ενεργό υπόβαθρο. */
  currentMapStyle: MapStyleType;

  /** Αλλαγή υποβάθρου. */
  onMapStyleChange: (style: MapStyleType) => void;

  /** Κατάσταση επιλογής σημείου — φτάνει σε `!== 'off'` **μόνο** μέσω `GeoMapControls`. */
  clickMode: 'off' | 'add_dxf' | 'add_geo';

  /** Ποια υπόβαθρα προσφέρονται και πώς — από το ακροατήριο, ποτέ από εδώ. */
  basemaps: MapChromeCapabilities['basemaps'];
  basemapSwitcher: MapChromeCapabilities['basemapSwitcher'];

  /** Ζωντανές συντεταγμένες + υψόμετρο. Στο δημόσιο: `false`. */
  coordinateReadout: boolean;

  /** Custom CSS class */
  className?: string;
}

// ============================================================================
// 🎛️ Ο ΔΙΑΚΟΠΤΗΣ ΥΠΟΒΑΘΡΟΥ
// ============================================================================
//
// 🔴 **ΤΟ ΕΝΕΡΓΟ ΔΕΝ ΞΕΧΩΡΙΖΕΙ ΜΕ `bg-primary`, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟ.** Στο
// **προεπιλεγμένο (σκοτεινό)** θέμα το `--primary` λύνεται σε `217 33% 17%`, δηλαδή
// **ταυτόσημο με το `--card`** (globals.css:267 vs :273) — το επιλεγμένο κουμπί πάνω
// στο πάνελ θα ήταν **1,00:1**, ούτε καν δυσδιάκριτο: **ανύπαρκτο**. Είναι το εύρημα
// που γέννησε ολόκληρη την εκστρατεία του ADR-770 (CHECK 3.38).
//
// 🔑 **ΤΡΙΑ ΚΑΝΑΛΙΑ, ΤΟ ΕΝΑ ΜΗ-ΧΡΩΜΑΤΙΚΟ** — η ίδια αρχή που επιβάλλει η CHECK 3.41
// («*ξέρω ΠΟΙΟ είναι ποιο χωρίς να δω χρώμα;*», WCAG 1.4.1): **βάρος γραμματοσειράς**
// (μη-χρωματικό) · **δακτύλιος** `--ring`, που είναι σκούρος στο φωτεινό και σχεδόν
// λευκός στο σκοτεινό, άρα αντιθετικός **και στα δύο** · και `aria-pressed` για τον
// αναγνώστη οθόνης. Το κείμενο μένει `text-foreground` **και στις δύο** καταστάσεις
// (16,1:1 φωτεινό · 14,2:1 σκοτεινό) αντί για `text-muted-foreground`, που στο
// **φωτεινό** δίνει **4,12:1** — κάτω από το 4,5:1 που ζητά το `text-xs`.

/** Επιλεγμένο υπόβαθρο: βάρος + δακτύλιος + απαλή επιφάνεια. */
const ACTIVE_BASEMAP = 'bg-muted text-foreground font-semibold ring-1 ring-ring';

/** Μη επιλεγμένο: **ίδια αναγνωσιμότητα**, χωρίς σήμανση. */
const INACTIVE_BASEMAP = `text-foreground font-normal ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`;

interface BasemapButtonProps {
  readonly choice: BasemapChoice;
  readonly active: boolean;
  readonly label: string;
  readonly onSelect: () => void;
}

/** Εικονίδιο + tooltip — για τον επαγγελματία, που έχει ποντίκι και ξέρει τις πηγές. */
function BasemapIconButton({ choice, active, label, onSelect }: BasemapButtonProps) {
  const iconSizes = useIconSizes();
  const Icon = MAP_STYLE_CATALOG[choice.style].icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={active}
          aria-label={label}
          className={`${iconSizes.lg} rounded text-xs transition-colors ${
            active ? ACTIVE_BASEMAP : INACTIVE_BASEMAP
          }`}
        >
          <Icon className={iconSizes.xs} />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Ετικέτα με λέξεις — για τον επισκέπτη.
 *
 * 🔴 **Χωρίς tooltip, επίτηδες (Α8).** Το tooltip δεν υπάρχει στην αφή· ένα κουμπί
 * που εξηγείται μόνο με hover είναι σε κινητό **ανώνυμο**.
 */
function BasemapLabelButton({ active, label, onSelect }: Omit<BasemapButtonProps, 'choice'>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`rounded px-2.5 py-1 text-xs transition-colors ${
        active ? ACTIVE_BASEMAP : INACTIVE_BASEMAP
      }`}
    >
      {label}
    </button>
  );
}

// ============================================================================
// 🌍 ΤΟ ΠΑΝΕΛ
// ============================================================================

export const GeoCoordinateDisplay: React.FC<GeoCoordinateDisplayProps> = ({
  hoveredCoordinate,
  currentMapStyle,
  onMapStyleChange,
  clickMode,
  basemaps,
  basemapSwitcher,
  coordinateReadout,
  className = '',
}) => {
  const { t } = useTranslation('geo-canvas');

  // 🔑 Σε λεκτική λειτουργία τα κουμπιά **λένε τι είναι**, οπότε η ορατή επικεφαλίδα
  // «Στυλ:» είναι πλεονασμός· η ομάδα κρατά το `aria-label` της για τον αναγνώστη
  // οθόνης. Σε εικονική λειτουργία τα κουμπιά **δεν** λένε, άρα η επικεφαλίδα μένει.
  const showStyleHeading = basemapSwitcher === 'icons';

  return (
    <section
      className={`absolute top-4 right-4 ${MAP_OVERLAY_SURFACE} ${className}`}
      aria-label={t('map.coordinate.displayLabel')}
    >
      <div className="space-y-1 text-sm">
        <header className={`flex items-center gap-3 ${coordinateReadout ? 'mb-2' : ''}`}>
          {showStyleHeading && (
            <span className="text-xs text-muted-foreground">{t('map.styleSelector.style')}</span>
          )}
          <div
            className="flex gap-1"
            role="group"
            aria-label={t('map.styleSelector.quickSwitcher')}
          >
            {basemaps.map((choice) => {
              const label = t(choice.labelKey);
              const active = currentMapStyle === choice.style;
              const onSelect = () => onMapStyleChange(choice.style);

              return basemapSwitcher === 'icons' ? (
                <BasemapIconButton
                  key={choice.style}
                  choice={choice}
                  active={active}
                  label={label}
                  onSelect={onSelect}
                />
              ) : (
                <BasemapLabelButton
                  key={choice.style}
                  active={active}
                  label={label}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </header>

        {coordinateReadout && hoveredCoordinate && (
          <div className="space-y-1" role="region" aria-label={t('map.coordinate.currentPosition')}>
            <div className="font-mono">
              {t('map.coordinate.longitude')}: {hoveredCoordinate.lng.toFixed(6)}
            </div>
            <div className="font-mono">
              {t('map.coordinate.latitude')}: {hoveredCoordinate.lat.toFixed(6)}
            </div>
            <div className="font-mono">
              {t('map.coordinate.altitude')}: {
                hoveredCoordinate.alt !== undefined
                  ? `${hoveredCoordinate.alt}m`
                  : t('map.coordinate.loading')
              }
            </div>
          </div>
        )}

        {/*
          ⚠️ Η προτροπή κλικ **δεν** έχει δική της σημαία στο `MAP_CHROME`, και είναι
          μετρημένο γιατί: το `clickMode` το αλλάζει **μόνο** ο `GeoMapControls`
          (`startCoordinatePicking`). Χωρίς εκείνον μένει για πάντα `'off'`. Μια σημαία
          εδώ θα ήταν φρουρός που δεν μπορεί να πυροδοτήσει (ADR-749 §5).

          ⚠️ **ΟΧΙ κίτρινο.** Ήταν ωμή κίτρινη κλίμακα Tailwind (`color-bridge:194`) — μονοθεματικό:
          πάνω στη **φωτεινή** επιφάνεια δίνει ~1,3:1, δηλαδή η προειδοποίηση
          εξαφανιζόταν ακριβώς όταν χρειαζόταν. Η προτροπή είναι **οδηγία**, όχι
          βαθμίδα σοβαρότητας· το «επείγον» το κουβαλά το `role="alert"`, όχι μια
          απόχρωση που σβήνει στο ένα από τα δύο θέματα (CHECK 3.41).
        */}
        {clickMode !== 'off' && (
          <div className="mt-2 text-xs font-medium text-foreground" role="alert">
            {t('map.coordinate.clickPrompt', {
              mode: clickMode === 'add_geo'
                ? t('map.coordinate.geographic')
                : t('map.coordinate.dxf')
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default GeoCoordinateDisplay;
