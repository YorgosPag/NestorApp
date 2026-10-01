'use client';

/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΕΠΑΓΓΕΛΜΑΤΙΩΝ** — δεξιά από τις κάρτες, στη σελίδα `/pro` (ADR-896).
 * @related lib/agency/showcase-map · CoverageFootprintLayer · components/owner-property/OwnerPortfolioMap
 * @module components/mandate/AgencyDirectoryMap
 *
 * 🔑 **Ο ΙΔΙΟΣ χάρτης με τα ακίνητα** (`ListingMapCanvas`): ίδιες πινέζες, ίδια σμήνη, ίδιες
 * εντάσεις εστίασης (`peeked` ≠ `selected`), ίδια στοίβα για πολλά σημάδια στο ίδιο σημείο. Ο
 * επισκέπτης που έμαθε να διαβάζει τον έναν χάρτη διαβάζει και τον άλλο.
 *
 * 🏆 **Τι προσθέτει ΜΟΝΟ εδώ — και κανείς από τους μεγάλους μαζί:**
 * 1. **Η δηλωμένη εμβέλεια στο hover**, με τα **πραγματικά** όρια δήμων/περιφερειών (ADR-883) —
 *    το Google δείχνει σχήμα εξυπηρέτησης μόνο στη σελίδα της επιχείρησης, όχι δίπλα στη λίστα.
 * 2. **Το «δεν δήλωσε» λέγεται** (`role="status"`) — ποτέ σιωπηλό κενό που μοιάζει με «παντού».
 * 3. **Όσοι δεν δείχνουν έδρα μετριούνται** — δεν εξαφανίζονται από τον χάρτη χωρίς λέξη.
 *
 * ⚠️ **Φορτώνεται τεμπέλικα** (`next/dynamic`, `ssr:false`) από το `AgencyDirectoryResults` —
 * η MapLibre δεν κατεβαίνει πριν χρειαστεί.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingFocusController } from '@/hooks/listings/useListingFocus';
import { useAdminBoundary } from '@/hooks/geo/useAdminBoundary';
import { focusedListingId } from '@/lib/listings/listing-focus';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { coverageShape, type CoverageShape } from '@/lib/agency/coverage-geometry';
import {
  showcaseArrivalExtent,
  showcaseMapEntry,
  showcaseMapGeoJson,
  showcaseMapPresence,
  showcasePins,
} from '@/lib/agency/showcase-map';
import { isAdministrativeWhere, type ShowcaseWhere } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';
import type { GeoPoint } from '@/types/geo/coordinates';
import { ListingMapCanvas } from '@/components/search-results/ListingMapCanvas';
import { AdminBoundaryLayer } from '@/components/search-results/AdminBoundaryLayer';

import { AGENCY_PUBLIC_NS, DIRECTORY_MAP_KEYS } from './agency-directory-labels';
import { AgencyMapPopup } from './AgencyMapPopup';
import { CoverageFootprintLayer } from './CoverageFootprintLayer';
import { CoversHerePrompt } from './CoversHerePrompt';
import { PresenceFootprintLayer } from './PresenceFootprintLayer';

const COVERAGE_STATUS_KEY: Readonly<Record<CoverageShape['kind'], string>> = {
  none: DIRECTORY_MAP_KEYS.coverageNone,
  nationwide: DIRECTORY_MAP_KEYS.coverageNationwide,
  drawn: DIRECTORY_MAP_KEYS.coverageShown,
  admin: DIRECTORY_MAP_KEYS.coverageShown,
};

export interface AgencyDirectoryMapProps {
  /** Οι **ορατοί** επαγγελματίες — μετά το φίλτρο, στη σειρά της λίστας. */
  readonly profiles: readonly PublicShowcase[];
  readonly focusController: ListingFocusController;
  /** Η περιοχή του φίλτρου· αν είναι διοικητική, ο χάρτης δείχνει το όριό της (όπως `/search/results`). */
  readonly where: ShowcaseWhere | null;
  /**
   * ADR-896 §7.1 — «Ποιος καλύπτει εδώ;»: η περιοχή που διάλεξε ο άνθρωπος από την κάρτα σημείου. Ο γονέας τη γράφει
   * στο **ίδιο** `where` με τα φίλτρα (διεύθυνση = η μόνη κατάσταση).
   */
  readonly onPickArea: (adminId: string) => void;
}

/** Το όριο της περιοχής αναζήτησης — μόνο για διοικητικό φίλτρο. */
function WhereBoundary({ where }: { readonly where: ShowcaseWhere | null }): React.ReactElement | null {
  const boundary = useAdminBoundary(where !== null && isAdministrativeWhere(where) ? where.adminId : null);
  return boundary.status === 'ready' ? <AdminBoundaryLayer geometry={boundary.boundary.geometry} /> : null;
}

/** «Πού δουλεύει αυτός που κοιτάς;» — με λέξεις, για όσους δεν βλέπουν το σχήμα (ή δεν υπάρχει σχήμα). */
function CoverageStatus({ focused }: { readonly focused: PublicShowcase | null }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const kind = focused === null ? null : coverageShape(focused.coverage).kind;
  return (
    <p role="status" className="m-0 h-6 truncate px-3 text-xs font-medium leading-6 text-foreground">
      {focused !== null && kind !== null ? t(COVERAGE_STATUS_KEY[kind], { name: focused.displayName }) : null}
      {/* ADR-896 §7.3 — η απόδειξη λέγεται ΚΑΙ με λέξεις (όχι μόνο με κουκκίδες)· ποτέ πλήθος. */}
      {focused !== null && focused.presence.length > 0 ? ` · ${t(DIRECTORY_MAP_KEYS.presenceShown)}` : null}
    </p>
  );
}

function AreaOnlyRow({ count }: { readonly count: number }): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  if (count === 0) return null;
  return <p className="m-0 border-t border-border px-3 py-2 text-xs text-muted-foreground">{t(DIRECTORY_MAP_KEYS.areaOnly, { count })}</p>;
}

export default function AgencyDirectoryMap({ profiles, focusController, where, onPickArea }: AgencyDirectoryMapProps) {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { focus, peek, select, clear } = focusController;
  /** Το σημείο της κάρτας «τι είναι εδώ;» — εφήμερο, όπως η στοίβα: δεν είναι φίλτρο ώσπου να πατηθεί το κουμπί. */
  const [emptyPoint, setEmptyPoint] = useState<GeoPoint | null>(null);
  const pickArea = useCallback((adminId: string) => {
    setEmptyPoint(null);
    onPickArea(adminId);
  }, [onPickArea]);

  const geojson = useMemo(() => showcaseMapGeoJson(profiles), [profiles]);
  const byId = useMemo(() => new Map(profiles.map((profile) => [profile.companyId, profile])), [profiles]);
  const areaOnly = useMemo(() => profiles.filter((profile) => showcaseMapPresence(profile) === 'area-only').length, [profiles]);

  const focusedId = focusedListingId(focus);
  const focused = focusedId === null ? null : (byId.get(focusedId) ?? null);
  const selected = focus.selected === null ? null : (byId.get(focus.selected) ?? null);
  const selectedPin = selected === null ? undefined : showcasePins(selected)[0];
  const focusedPins = useMemo(() => (focused === null ? [] : showcasePins(focused).map((pin) => pin.point)), [focused]);

  const describeListing = useCallback((id: string): ListingMapEntry | null => {
    const profile = byId.get(id);
    return profile === undefined ? null : showcaseMapEntry(profile);
  }, [byId]);

  const arrivalArea = useCallback((id: string) => {
    const profile = byId.get(id);
    return profile === undefined ? null : showcaseArrivalExtent(profile);
  }, [byId]);

  return (
    <section aria-label={t(DIRECTORY_MAP_KEYS.label)} className="flex h-full flex-col overflow-hidden rounded-md border border-border">
      <p className="m-0 px-3 pt-2 text-xs text-muted-foreground">{t(DIRECTORY_MAP_KEYS.hint)}</p>
      <CoverageStatus focused={focused} />
      <figure className="relative m-0 min-h-0 flex-1">
        <ListingMapCanvas geojson={geojson} focus={focus} onPeek={peek} onSelect={select} onClear={clear} onEmptyPoint={setEmptyPoint} describeListing={describeListing} arrivalArea={arrivalArea}>
          <WhereBoundary where={where} />
          {/* 🔑 Ό,τι κοιτάς (peeked) κερδίζει ό,τι διάλεξες — όπως το σκιασμένο της κάρτας. */}
          {focused !== null && (
            <CoverageFootprintLayer
              coverage={focused.coverage}
              emphasis={focus.peeked === focused.companyId ? 'peeked' : 'selected'}
              pins={focusedPins}
            />
          )}
          {focused !== null && <PresenceFootprintLayer presence={focused.presence} />}
          {/* Δεμένο στο `selected`, ΠΟΤΕ στο `peeked` (βλ. `AgencyMapPopup`). */}
          {selected !== null && selectedPin !== undefined && (
            <AgencyMapPopup profile={selected} point={selectedPin.point} onClose={clear} />
          )}
          {/* Μία αιωρούμενη επιφάνεια τη φορά: η φούσκα της επιλογής κερδίζει την κάρτα σημείου. */}
          {selected === null && emptyPoint !== null && (
            <CoversHerePrompt point={emptyPoint} onPick={pickArea} onClose={() => setEmptyPoint(null)} />
          )}
        </ListingMapCanvas>
      </figure>
      <AreaOnlyRow count={areaOnly} />
    </section>
  );
}
