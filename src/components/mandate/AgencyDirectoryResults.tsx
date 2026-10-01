'use client';

/**
 * @fileoverview **ΚΑΡΤΕΣ ‖ ΧΑΡΤΗΣ** — τα αποτελέσματα του καταλόγου `/pro` (ADR-896).
 * @related components/shared/list-map/ListMapSplit · AgencyDirectoryMap · AgencyCard · AgencyDirectoryContent
 * @module components/mandate/AgencyDirectoryResults
 *
 * 🔑 **Η ΣΕΙΡΑ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΕΔΩ** (ADR-843): οι κάρτες έρχονται ήδη ταξινομημένες από το
 * `orderAgencies` και φιλτραρισμένες από το `applyShowcaseFilters`. Ο χάρτης **δείχνει** τους ίδιους,
 * δεν αποφασίζει τίποτα — ούτε αριθμούς στις πινέζες, ούτε «κορυφαίους».
 *
 * 🔑 **Η επιλογή ζει στο URL** (`?selected=<companyId>`, `useUrlListingFocus`) — ο σύνδεσμος
 * ανοίγει τον κατάλογο με τον επαγγελματία επιλεγμένο και την περιοχή του στον χάρτη.
 */

import React, { useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useUrlListingFocus, type ListingFocusController } from '@/hooks/listings/useListingFocus';
import { listingFocusStrength } from '@/lib/listings/listing-focus';
import type { ListingMapEntry } from '@/lib/listings/listing-map-entry';
import { hasDirectoryMap, showcaseMapEntry } from '@/lib/agency/showcase-map';
import type { ShowcaseWhere } from '@/types/agency-coverage';
import type { PublicShowcase } from '@/types/agency-profile';
import { ListMapSplit } from '@/components/shared/list-map/ListMapSplit';

import { AGENCY_PUBLIC_NS, DIRECTORY_MAP_KEYS, DIRECTORY_VIEW_KEYS } from './agency-directory-labels';
import { AgencyCard } from './AgencyCard';

/** Η κράτηση θέσης γεμίζει τον **ίδιο** περιέκτη με τον χάρτη ⇒ μηδέν μετατόπιση όταν φτάσει. */
function MapPending(): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  return (
    <p aria-busy="true" className="m-0 flex h-full items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
      {t(DIRECTORY_MAP_KEYS.loading)}
    </p>
  );
}

const AgencyDirectoryMap = dynamic(() => import('./AgencyDirectoryMap'), { ssr: false, loading: MapPending });

interface AgencyListProps {
  readonly profiles: readonly PublicShowcase[];
  readonly where: ShowcaseWhere | null;
  /** Απών ⇒ δεν υπάρχει χάρτης, άρα οι κάρτες δεν «φωτίζονται» για κανέναν. */
  readonly focusController?: ListingFocusController;
}

function AgencyList({ profiles, where, focusController }: AgencyListProps): React.ReactElement {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {profiles.map((profile) => (
        <AgencyCard
          key={profile.companyId}
          profile={profile}
          where={where}
          focusStrength={focusController ? listingFocusStrength(focusController.focus, profile.companyId) : 'none'}
          onHover={focusController?.peek}
        />
      ))}
    </ul>
  );
}

export interface AgencyDirectoryResultsProps {
  readonly profiles: readonly PublicShowcase[];
  readonly where: ShowcaseWhere | null;
  /** ADR-896 §7.1 — «Ποιος καλύπτει εδώ;» από τον χάρτη ⇒ διοικητικό φίλτρο. */
  readonly onPickArea: (adminId: string) => void;
}

export function AgencyDirectoryResults({ profiles, where, onPickArea }: AgencyDirectoryResultsProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const focusController = useUrlListingFocus();
  const byId = useMemo(() => new Map(profiles.map((profile) => [profile.companyId, profile])), [profiles]);

  const describe = useCallback((id: string): ListingMapEntry | null => {
    const profile = byId.get(id);
    return profile === undefined ? null : showcaseMapEntry(profile);
  }, [byId]);

  const renderList = useCallback(
    (mapped: boolean) => <AgencyList profiles={profiles} where={where} focusController={mapped ? focusController : undefined} />,
    [profiles, where, focusController],
  );

  return (
    <ListMapSplit
      // ADR-896 §7.1 — με ενεργό τόπο ο χάρτης έχει ΠΑΝΤΑ κάτι να πει (το όριο), ακόμη κι αν κανείς από τους ορατούς
      // δεν έχει πινέζα ή σχήμα: αλλιώς το «Ποιος καλύπτει εδώ;» θα έσβηνε τον χάρτη από τον οποίο ρωτήθηκε.
      mapAvailable={hasDirectoryMap(profiles) || where !== null}
      renderList={renderList}
      map={<AgencyDirectoryMap profiles={profiles} focusController={focusController} where={where} onPickArea={onPickArea} />}
      focusController={focusController}
      describe={describe}
      viewLabels={{ label: t(DIRECTORY_VIEW_KEYS.label), list: t(DIRECTORY_VIEW_KEYS.list), map: t(DIRECTORY_VIEW_KEYS.map) }}
    />
  );
}
