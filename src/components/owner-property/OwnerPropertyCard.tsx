'use client';

/**
 * @fileoverview **Μία αγγελία στον κατάλογο του ιδιοκτήτη** — και **αν φτάνει στον χάρτη**.
 * @related ADR-777 §7 (Α5 · Α14 · Α22) · types/owner-property.ts · public-listing-projection
 * @module components/owner-property/OwnerPropertyCard
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΑΡΤΑ ΔΕΝ ΞΑΝΑΚΡΙΝΕΙ ΤΙΠΟΤΑ — ΡΩΤΑΕΙ ΤΟΥΣ ΙΔΙΟΥΣ ΚΡΙΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το *«είναι στον δημόσιο χάρτη;»* το απαντά **αποκλειστικά** η σύνθεση
 * `projectableFromOwnerProperty` → {@link isPubliclyListed} — η **ίδια** διαδρομή που
 * εκτελεί ο γραφέας στον διακομιστή. Ένα `offers.length > 0 && lifecycle === 'listed'`
 * γραμμένο εδώ θα ήταν **δεύτερος κριτής**: η οθόνη θα έλεγε «είναι στον χάρτη» ενώ ο
 * γραφέας θα είχε σβήσει την προβολή, και ο άνθρωπος **δεν θα είχε κανέναν τρόπο να
 * το μάθει**. Είναι το ίδιο μάθημα με τη φρεσκάδα της `DemandCard`.
 *
 * 🔑 **Και γι' αυτό δεν χρειάζεται ανάγνωση του `public_listings`**: το κριτήριο είναι
 * **καθαρή συνάρτηση** πάνω σε δεδομένα που ήδη έχουμε. Μια δεύτερη ανάγνωση ανά κάρτα
 * θα ήταν N ερωτήματα για πληροφορία που είναι **υπολογίσιμη** — και η **Α0** δεσμεύει
 * «μοντέλο για την τελική κλίμακα».
 *
 * ⚠️ **Η θέση αναφέρεται ΠΑΝΤΑ, ακόμη κι όταν λείπει** (Α5 §4.1: *ποτέ σιωπηλή
 * εξαφάνιση*). Ο κάτοχος που δεν δήλωσε θέση οφείλει να βλέπει **γιατί** το ακίνητό
 * του δεν είναι στον χάρτη — και να μπορεί να το διορθώσει με ένα κλικ (§4.3: *«το
 * γέμισμα της θέσης είναι το δόλωμα, ποτέ το φράγμα»*).
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PROPERTY_TYPE_I18N_KEYS, isCanonicalPropertyType } from '@/constants/property-types';
import { nowISO } from '@/lib/date-local';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { isPubliclyListed } from '@/services/listings/public-listing-projection';
import { ownerPropertyOfferKinds, type OwnerProperty } from '@/types/owner-property';

const NS = 'property-market';
const K = `${NS}:offer`;

export function OwnerPropertyCard({
  property,
}: {
  property: OwnerProperty;
}): React.ReactElement {
  const { t } = useTranslation([NS, 'properties-enums']);

  // 🔴 Ο **ίδιος** κριτής με τον διακομιστή. Δες την επικεφαλίδα του αρχείου.
  // ⚠️ **Μία ανάγνωση ρολογιού ανά απόδοση** (§8.33): η λήξη της εντολής κρίνεται με
  // την ίδια στιγμή για κάθε κάρτα της λίστας.
  const onMap = isPubliclyListed(projectableFromOwnerProperty(property, nowISO()));
  const kinds = ownerPropertyOfferKinds(property);

  return (
    <article className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{property.title}</h2>
        <span className="text-sm text-muted-foreground">
          {t(`${K}.lifecycle.${property.lifecycle}`)}
        </span>
      </header>

      <p className="text-sm text-foreground">
        {isCanonicalPropertyType(property.type)
          ? t(`properties-enums:${PROPERTY_TYPE_I18N_KEYS[property.type]}`)
          : property.type}
        {property.areaSqm !== null && ` · ${t(`${K}.card.area`, { area: property.areaSqm })}`}
        {property.floor !== null && ` · ${t(`${K}.card.floor`, { floor: property.floor })}`}
        {property.bedrooms !== null &&
          ` · ${t(`${K}.card.bedrooms`, { count: property.bedrooms })}`}
      </p>

      {kinds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {kinds.map((kind) => t(`${K}.offerKind.${kind}`)).join(' · ')}
        </p>
      )}

      {/*
        ⚠️ Η θέση **δεν σιωπά ποτέ** (Α5 §4.1). Και τα δύο μηνύματα είναι ουδέτερα:
        το «χωρίς δηλωμένη θέση» δεν είναι επίπληξη — είναι **η κατάσταση**, με τη
        θεραπεία ένα κλικ μακριά.
      */}
      {property.place.kind === 'declared' ? (
        <p className="text-sm text-muted-foreground">{property.place.label}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`${K}.card.noPlace`)}</p>
      )}

      <p className="text-sm text-foreground">
        {t(onMap ? `${K}.publish.published` : `${K}.publish.withdrawn`)}
      </p>

      <nav>
        <Link
          href={offerDetailHref(property.id)}
          className="inline-block rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground"
        >
          {t(`${K}.list.open`)}
        </Link>
      </nav>
    </article>
  );
}
