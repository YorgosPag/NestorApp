'use client';

/**
 * @fileoverview 🏆 **Η ΨΗΦΙΑΚΗ ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΚΑΡΤΑ ΣΤΗ ΔΗΜΟΣΙΑ ΒΙΤΡΙΝΑ** (ADR-841 §7 Α21.16).
 * @related components/mandate/AgencyProfileContent.tsx · types/showcase-card.ts
 * @module components/mandate/ShowcaseContactCard
 *
 * 🔑 **ΤΙ ΞΕΠΕΡΝΑ ΤΟΥΣ ΜΕΓΑΛΟΥΣ, ΣΥΝΟΠΤΙΚΑ**:
 *   • ο αριθμός **δεν υπάρχει** ούτε στο HTML ούτε στη δημόσια βάση — έρχεται ένα κατάστημα τη
 *     φορά, με όριο ρυθμού (Idealista/XE κρύβουν μόνο από το HTML)·
 *   • «ανοιχτό τώρα» σε ώρα Ελλάδας, με υπολογισμένες αργίες (καμία πλατφόρμα ακινήτων)·
 *   • λειτουργία «μόνο περιοχή» για όποιον δεν δέχεται επισκέψεις (Google SAB)·
 *   • οδηγίες μετάβασης **μόνο** όταν δημοσιεύτηκε οδός — δεν οδηγούμε κανέναν στην κατοικία τρίτου.
 *
 * 🔴 **Η ΣΕΙΡΑ ΕΙΝΑΙ Η ΑΠΟΦΑΣΗ ΠΟΥ ΕΜΕΙΝΕ** (ADR-827 §9.8, τροποποίηση): η κάρτα αποδίδεται **κάτω**
 * από τις πράξεις της σελίδας, και στον **μεσίτη** θυμίζει δίπλα στο τηλέφωνο ότι η σύμβαση
 * γίνεται γραπτώς. Στον τεχνίτη **δεν** το λέει — θα ήταν ψευδής πρόταση.
 */

import React from 'react';
import { Navigation } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublicPlace } from '@/services/realtime/hooks/usePublicPlace';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { googleMapsDirectionsUrl } from '@/lib/geo/map-links';
import type { ShowcaseLocation } from '@/types/showcase-card';
import { AGENCY_PUBLIC_NS, PROFILE_KEYS, PROFILE_ROLE_KEYS } from './agency-directory-labels';
import { ChannelReveal } from './ChannelReveal';
import { ShowcaseOpeningHours } from './ShowcaseOpeningHours';

interface ShowcaseContactCardProps {
  readonly locations: readonly ShowcaseLocation[];
  readonly companyId: string;
  /** Περνιέται, δεν ξαναρωτιέται (ADR-841 §7 Α5) — ίδιος κριτής με το κουμπί από πάνω. */
  readonly canHoldMandate: boolean;
}

function LocationAddress({ location }: { readonly location: ShowcaseLocation }): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const place = usePublicPlace(location.place);
  const area = place.state === 'found' ? place.land.displayAddress : null;
  const street = location.street === null ? null : formatContactAddressLine({ ...location.street, country: 'GR' });

  return (
    <address className="flex flex-col gap-0.5 text-sm not-italic text-foreground">
      {street !== null ? <span>{street}</span> : null}
      {area !== null ? <span className="text-muted-foreground">{area}</span> : null}
      {street === null ? <span className="text-xs text-muted-foreground">{t(PROFILE_KEYS.cardAreaOnly)}</span> : null}
    </address>
  );
}

function LocationCard({
  location,
  companyId,
  canHoldMandate,
}: { readonly location: ShowcaseLocation } & Omit<ShowcaseContactCardProps, 'locations'>): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const role = t(PROFILE_ROLE_KEYS[location.role]);

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-col gap-0.5">
        <h3 className="m-0 text-base font-semibold text-foreground">{location.label ?? role}</h3>
        {location.label !== null ? <p className="m-0 text-xs text-muted-foreground">{role}</p> : null}
      </header>
      <LocationAddress location={location} />
      {location.street !== null && location.position !== null ? (
        <a
          href={googleMapsDirectionsUrl(location.position)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-foreground underline underline-offset-4"
        >
          <Navigation aria-hidden="true" className="h-4 w-4" /> {t(PROFILE_KEYS.cardDirections)}
        </a>
      ) : null}
      {location.hours !== null ? <ShowcaseOpeningHours hours={location.hours} /> : null}
      <ChannelReveal companyId={companyId} locationId={location.id} kinds={location.channelKinds} />
      {canHoldMandate && location.channelKinds.includes('phone') ? (
        <p className="m-0 text-xs text-muted-foreground">{t(PROFILE_KEYS.cardBrokerWritten)}</p>
      ) : null}
    </article>
  );
}

export function ShowcaseContactCard({ locations, companyId, canHoldMandate }: ShowcaseContactCardProps): React.ReactElement | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  // 🔑 Χωρίς κάρτα **σιωπή** — όχι «δεν δηλώθηκε»: η απουσία καναλιού δεν είναι πια απόφαση να εξηγηθεί.
  if (locations.length === 0) return null;

  return (
    <section aria-labelledby="showcase-contact-title" className="flex flex-col gap-3">
      <h2 id="showcase-contact-title" className="m-0 text-lg font-semibold text-foreground">
        {t(PROFILE_KEYS.cardTitle)}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {locations.map((location) => (
          <li key={location.id}>
            <LocationCard location={location} companyId={companyId} canHoldMandate={canHoldMandate} />
          </li>
        ))}
      </ul>
    </section>
  );
}
