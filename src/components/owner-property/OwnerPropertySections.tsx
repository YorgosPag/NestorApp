'use client';

/**
 * @fileoverview **Τι αποδίδει κάθε ενότητα** της σελίδας ακινήτου ιδιοκτήτη. Τα μπλοκ είναι **τα ίδια** με την παλιά
 * μονόστηλη σελίδα — άλλαξε μόνο η θέση τους (ADR-946). Κάθε σχόλιο-συμβόλαιο σειράς ταξίδεψε μαζί με το μπλοκ του.
 * @related ADR-946 · `owner-property-sections.ts` (το μητρώο) · ADR-777 · ADR-834 · ADR-864 · ADR-900 · ADR-915 · ADR-945
 * @module components/owner-property/OwnerPropertySections
 */

import React from 'react';
import dynamic from 'next/dynamic';

import { PlaceInterestPanel } from '@/components/demand/PlaceInterestPanel';
import { ListingMapSnapshotProvider } from '@/components/listing-map-snapshot/ListingMapSnapshotProvider';
import {
  MarketingAudienceControl,
  type AudienceChangeOutcome,
} from '@/components/listings/MarketingAudienceControl';
import { isAppFeatureEnabled } from '@/config/feature-flags';
import { isLandProperty } from '@/constants/property-classification';
import type { PlaceInterestState } from '@/hooks/demand/usePlaceInterest';
import type { ListingStatsState } from '@/hooks/owner-property/useOwnerPortfolioStats';
import type { OwnerMandateView } from '@/lib/mandate/owner-mandate-view';
import { isUnitLevelUndeclared } from '@/lib/owner-property/owner-property-unit-form';
import { setOwnerListingAudience } from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';

import { OwnerIssuanceSurfaces } from './owner-issuance-surfaces';
import { isOwnerPropertySection } from './owner-property-sections';
import { StatsPanelPending } from './owner-property-stats-pending';
import { OwnerMandatePanel } from './OwnerMandatePanel';
import { OwnerPropertyCard } from './OwnerPropertyCard';
import { OwnerPropertyHistory } from './OwnerPropertyHistory';
import { PrivateMarketingOwnerSection } from './PrivateMarketingOwnerSection';

/**
 * 💬 ADR-867 Β7 — **ΟΡΙΟ ΚΛΕΙΣΤΟΤΗΤΑΣ** (CHECK 3.34 Κ2): οι συνομιλίες με τα γραφεία είναι νησίδα **μόνο για
 * συνδεδεμένους**, με δικό τους namespace που φορτώνεται όταν ανοίξουν. ⚠️ Όχι `ssr: false`.
 */
const OwnerMandateThreads = dynamic(() =>
  import('@/components/network-messaging/OwnerMandateThreads').then((mod) => mod.OwnerMandateThreads),
);

/** ADR-900 §3.8 — η κάρτα επαλήθευσης ιδιοκτησίας, πίσω από **όριο** (ο route slice μένει στο ταβάνι του). */
const OwnershipVerificationPanel = dynamic(() =>
  import('./OwnershipVerificationPanel').then((mod) => mod.OwnershipVerificationPanel),
);

/** 📋 ADR-915 §37 (Β2) — μόνιμες υποχρεώσεις· `ssr: false`: εκτός route slice (3.34), ιδίωμα `DocumentsTab`. */
const PropertyUpkeepSection = dynamic(
  () => import('@/components/document-registry/PropertyUpkeepSection').then((mod) => mod.PropertyUpkeepSection),
  { ssr: false },
);

/** 📊 ADR-777 §8.72 — ο πίνακας γεμίζει **μόνο** στον πελάτη (εκτός route slice). ⚠️ Όχι `ssr: false`. */
const OwnerPropertyStatsPanel = dynamic(
  () => import('./OwnerPropertyStatsPanel').then((mod) => mod.OwnerPropertyStatsPanel),
  { loading: StatsPanelPending },
);

/** Ό,τι έχει ήδη υπολογίσει η όψη — **ένα** ρολόι, **ένα** fetch (δες `OwnerPropertyView`). */
export interface OwnerSectionData {
  readonly property: OwnerProperty;
  readonly onMap: boolean;
  /** Η αγγελία **δικαιούται** αλλά ο γραφέας απέτυχε (Ν11: «δικαιούται» ≠ «έφτασε»). */
  readonly unpublished: boolean;
  readonly offered: boolean;
  readonly mandateViews: readonly OwnerMandateView[];
  readonly interest: PlaceInterestState;
  readonly stats: ListingStatsState;
  readonly onEdit: () => void;
}

/**
 * **Αποτέλεσμα πύλης → αποτέλεσμα πράξης κοινού** (ADR-864 Α21): η άρνηση συναίνεσης φτάνει **ονομασμένη** στην
 * οθόνη — ποτέ ως γενικό «απέτυχε».
 */
function audienceOutcomeOf(result: Awaited<ReturnType<typeof setOwnerListingAudience>>): AudienceChangeOutcome {
  if (result.kind === 'saved') return { kind: 'saved' };
  if (result.kind === 'invalid' && result.violations.includes('private-marketing-consent-missing')) {
    return { kind: 'refused', reason: 'private-marketing-consent-missing' };
  }
  return { kind: 'failed' };
}

/**
 * **Επισκόπηση** — η κάρτα, «πώς πάει η αγγελία μου» (μόνο στην αγορά: εκτός αγοράς οι μηδενικές ημέρες σημαίνουν «δεν
 * ήταν εκεί»), και το δόλωμα του §12.6 «N άνθρωποι ψάχνουν κάτι σαν το δικό σας» — **και** χωρίς δημοσίευση.
 */
function OverviewSection({ data }: { readonly data: OwnerSectionData }) {
  const { property } = data;
  return (
    <>
      <ListingMapSnapshotProvider>
        <OwnerPropertyCard property={property} priority stats={data.stats} ownPage={{ onAddPhotos: data.onEdit }} />
      </ListingMapSnapshotProvider>
      {data.onMap && (
        <OwnerPropertyStatsPanel stats={data.stats} listedAt={property.listedAt} priceHistory={property.priceHistory} />
      )}
      <PlaceInterestPanel
        interest={data.interest}
        audience={property.marketingAudience}
        unitIncomplete={isUnitLevelUndeclared(property, isLandProperty(property.type))}
      />
    </>
  );
}

/**
 * **Εντολή & μάρκετινγκ** — ποιος διαχειρίζεται το σπίτι (ADR-834) και η συνομιλία κάτω από την εντολή του (ADR-867
 * Β7)· μετά **ποιος βλέπει** (ADR-864 Ε-10: δίπλα στην απόσυρση, όχι στη φόρμα) και **ακριβώς από κάτω** η συναίνεση
 * που ζητά (§18 — «εκεί λέγεται, εδώ δίνεται»). Χωρίς εντολή, το πλαίσιο εντολής δεν αποδίδεται καθόλου.
 */
function MandateSection({ data }: { readonly data: OwnerSectionData }) {
  const { property } = data;
  return (
    <>
      <OwnerMandatePanel views={data.mandateViews} />
      <OwnerMandateThreads record={{ propertyId: property.id, mandates: property.mandates }} />
      <MarketingAudienceControl
        audience={property.marketingAudience}
        offered={data.offered}
        unpublished={data.unpublished}
        onChange={async (next) => audienceOutcomeOf(await setOwnerListingAudience(property.id, next))}
      />
      <PrivateMarketingOwnerSection
        ownerPropertyId={property.id}
        marketingAudience={property.marketingAudience}
        revision={property.updatedAt}
      />
    </>
  );
}

/**
 * **Έγγραφα & υποχρεώσεις** — επαλήθευση ιδιοκτησίας (μόνο ιδιωτική αγγελία, ADR-900 §3.8) · μόνιμες υποχρεώσεις
 * (ADR-915 §37) · αιτήματα έκδοσης (ADR-945, **μόνο** με ανοιχτό `OWNER_ISSUANCE_REQUESTS`).
 */
function DocumentsSection({ data }: { readonly data: OwnerSectionData }) {
  const { property } = data;
  return (
    <>
      {property.authorCompanyId === null && (
        <OwnershipVerificationPanel
          ownerPropertyId={property.id}
          dossier={
            property.dossierId === undefined
              ? null
              : { id: property.dossierId, userId: property.authorUserId, label: property.title }
          }
        />
      )}
      <PropertyUpkeepSection propertyId={property.id} />
      {isAppFeatureEnabled('OWNER_ISSUANCE_REQUESTS') && (
        <OwnerIssuanceSurfaces.OwnerIssuanceRequestSection propertyId={property.id} />
      )}
    </>
  );
}

/** Η ενεργή ενότητα. Άγνωστο id δεν φτάνει εδώ (το επικυρώνει το `useUrlSection`)· αν φτάσει ⇒ η επισκόπηση. */
export function OwnerPropertySectionContent({
  sectionId,
  data,
}: {
  readonly sectionId: string;
  readonly data: OwnerSectionData;
}): React.ReactElement {
  const id = isOwnerPropertySection(sectionId) ? sectionId : 'overview';
  switch (id) {
    case 'overview':
      return <OverviewSection data={data} />;
    case 'mandate':
      return <MandateSection data={data} />;
    case 'documents':
      return <DocumentsSection data={data} />;
    case 'history':
      // 📜 ADR-864 Φ1β — το βιβλίο το αποφασίζει η θεματοφυλακή, όχι αυτή η οθόνη.
      return <OwnerPropertyHistory property={data.property} />;
  }
}
