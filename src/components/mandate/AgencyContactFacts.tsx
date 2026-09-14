'use client';

/**
 * @fileoverview 🏆 **«ΕΔΡΑ» ΚΑΙ «ΕΠΙΚΟΙΝΩΝΙΑ» ΣΤΗΝ ΚΟΡΥΦΗ ΤΗΣ ΒΙΤΡΙΝΑΣ** (ADR-841 §7 Α21.17).
 * @related components/mandate/AgencyProfileContent.tsx · components/mandate/ShowcaseContactCard.tsx (οι λεπτομέρειες)
 * @module components/mandate/AgencyContactFacts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ — ΔΥΟ ΑΛΗΘΕΙΕΣ ΓΙΑ ΤΗΝ «ΕΔΡΑ» ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ (Giorgio, στιγμιότυπο 2026-09-14)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή «Έδρα» διάβαζε το παλιό `profile.place`, ενώ η κάρτα (Α21.16) δηλώνει **δική της** έδρα. Με
 * κάρτα συμπληρωμένη, η κορυφή θα έγραφε «Δεν δηλώθηκε» και η κάρτα από κάτω τη διεύθυνση — ορατή
 * αντίφαση. ⇒ **Η έδρα της κάρτας κερδίζει**· το `place` μένει εφεδρεία για βιτρίνες χωρίς κάρτα.
 *
 * 🏆 **Η ΕΠΙΚΟΙΝΩΝΙΑ ΨΗΛΑ, ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ** (Google Business Profile · Zillow · Houzz): δίπλα στην
 * ταυτότητα, όχι μετά τις αγγελίες. Η ιστοσελίδα **ορατή** (δεν είναι προσωπικό δεδομένο)· τηλέφωνο και
 * email **πίσω από την ίδια πόρτα** με όριο (αρχή #1 της Α21.16 — ο αριθμός δεν μπαίνει ποτέ στο HTML).
 *
 * ⚠️ **Κανένα νέο κλειδί κειμένου**: «Έδρα» και «Επικοινωνία» υπάρχουν ήδη (`placeLabel` · `cardTitle`), και
 * ο σύνδεσμος γράφει τον **host** της ιστοσελίδας. Το route slice του `/pro/[alias]` είχε 56 bytes περιθώριο.
 */

import React from 'react';
import { Globe } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { primaryChannelLocation } from '@/lib/agency/showcase-card-primary';
import { usePublicPlace } from '@/services/realtime/hooks/usePublicPlace';
import { formatContactAddressLine } from '@/utils/address/address-line';
import type { PublicShowcase } from '@/types/agency-profile';
import type { ShowcaseLocation } from '@/types/showcase-card';
import { AGENCY_PUBLIC_NS, PROFILE_KEYS } from './agency-directory-labels';
import { Fact } from './AgencyFact';
import { ChannelReveal } from './ChannelReveal';
import { SaveContactLink } from './ShowcaseContactCard';

const LINK_CLASS = 'inline-flex items-center gap-2 self-start font-medium text-foreground underline underline-offset-4';

function headquartersOf(profile: PublicShowcase): ShowcaseLocation | null {
  return profile.locations.find(({ role }) => role === 'headquarters') ?? null;
}

/** `https://www.vafes.gr/` → `vafes.gr` — αυτό που αναγνωρίζει ο άνθρωπος. */
function websiteHost(website: string): string {
  return new URL(website).hostname.replace(/^www\./, '');
}

/**
 * **«Έδρα»** — από την κάρτα, με εφεδρεία το παλιό `place`.
 *
 * ⚠️ Ό,τι δεν είναι `found` γίνεται «δεν δηλώθηκε» — ΚΑΙ το `error`: η περιοχή είναι **διακοσμητική**
 * πληροφορία, όχι η απάντηση της σελίδας (N.12 δεν παραβιάζεται — η σελίδα απαντά «υπάρχει;»).
 */
export function PlaceFact({ profile }: { readonly profile: PublicShowcase }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const headquarters = headquartersOf(profile);
  const place = usePublicPlace(headquarters?.place ?? profile.place);
  const area = place.state === 'found' ? place.land.displayAddress : null;
  const street =
    headquarters?.street != null ? formatContactAddressLine({ ...headquarters.street, country: 'GR' }) : null;

  return (
    <Fact
      label={t(PROFILE_KEYS.placeLabel)}
      value={street ?? area ?? t(PROFILE_KEYS.placeUnknown)}
      hint={street !== null && area !== null ? area : undefined}
    />
  );
}

/**
 * **«Επικοινωνία»** — ιστοσελίδα, εμφάνιση καναλιών, αποθήκευση επαφής. Σιωπή όταν δεν υπάρχει τίποτα.
 *
 * 🔴 **Η ΥΠΕΝΘΥΜΙΣΗ ΤΟΥ ΜΕΣΙΤΗ ΑΝΕΒΑΙΝΕΙ ΜΑΖΙ ΜΕ ΤΟ ΤΗΛΕΦΩΝΟ** (αρχή της Α21.16): στον μεσίτη, δίπλα στο τηλέφωνο,
 * *«η σύμβαση καταρτίζεται εγγράφως»*. Ο κριτής `canHoldMandate` **περνιέται**, δεν ξαναρωτιέται (Α5) — στον τεχνίτη
 * η πρόταση θα ήταν ψευδής, και σιωπά.
 */
export function ContactFact({
  profile,
  canHoldMandate,
}: {
  readonly profile: PublicShowcase;
  readonly canHoldMandate: boolean;
}): React.JSX.Element | null {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const primary = primaryChannelLocation(profile.locations);
  if (primary === null && profile.website === null) return null;

  return (
    <Fact label={t(PROFILE_KEYS.cardTitle)}>
      {profile.website !== null ? (
        // 🔑 `nofollow ugc`: δήλωση τρίτου, όχι σύσταση της πλατφόρμας (οδηγίες Google για συνδέσμους χρηστών).
        <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow ugc" className={LINK_CLASS}>
          <Globe aria-hidden="true" className="h-4 w-4" /> {websiteHost(profile.website)}
        </a>
      ) : null}
      {primary !== null ? (
        <>
          <ChannelReveal companyId={profile.companyId} locationId={primary.id} kinds={primary.channelKinds} />
          <SaveContactLink companyId={profile.companyId} location={primary} />
          {canHoldMandate && primary.channelKinds.includes('phone') ? (
            <span className="text-xs">{t(PROFILE_KEYS.cardBrokerWritten)}</span>
          ) : null}
        </>
      ) : null}
    </Fact>
  );
}
