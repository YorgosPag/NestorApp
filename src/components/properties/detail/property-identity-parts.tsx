'use client';

/**
 * @fileoverview **ΤΑΥΤΟΤΗΤΑ ΜΕ ΜΙΑ ΜΑΤΙΑ** — «κοιτάω το σωστό ακίνητο;» — ως **μέρη** της ΜΙΑΣ κεφαλίδας.
 * @related ADR-777 §8.30 · §8.87 · §7 (Α6: η τιμή φαίνεται) · features/properties-sidebar/components/PropertyDetailsHeader
 * @module components/properties/detail/property-identity-parts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΗΤΑΝ ΔΕΥΤΕΡΗ ΚΕΦΑΛΙΔΑ, ΚΑΙ ΕΓΙΝΕ ΜΕΡΗ ΤΗΣ ΠΡΩΤΗΣ (§8.87)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως αυτόνομο `PropertyIdentityHeader` στεκόταν **πάνω** από την κεφαλίδα της επιφάνειας, και η σελίδα έλεγε το
 * όνομα του ακινήτου **δύο φορές**, με τις ενέργειες στη δεύτερη. Σχήμα σελίδας εγγραφής (Salesforce highlights
 * panel · Shopify · Zillow): **μία** κεφαλίδα — ταυτότητα αριστερά, ενέργειες δεξιά. Τα μέρη εδώ γεμίζουν τις
 * θυρίδες του `EntityDetailsHeader` (`media` · `subtitle` · `titleAdornment` · `details`)· τίτλο και ενέργειες
 * τα κρατά ο ΕΝΑΣ ιδιοκτήτης τους, το `PropertyDetailsHeader`.
 *
 * 🔑 **ΚΑΜΙΑ ΤΙΜΗ ΔΕΝ ΜΕΤΑΦΡΑΖΕΤΑΙ ΔΕΥΤΕΡΗ ΦΟΡΑ.** Ό,τι *σημαίνει* κάτι έρχεται από το ίδιο SSoT με την κάρτα
 * πλέγματος: `resolveDisplayPrice` (ποια τιμή) · `buildCardPriceText` (πώς λέγεται) · `MISSING_PRICE_LABEL_KEYS`
 * (πώς λέγεται η **απουσία** της) · `buildPropertyStatusBadge` (ποια κατάσταση) · `useFloorLabel` (ADR-903).
 * Εδώ ζει **μόνο** η διάταξη.
 *
 * ⚠️ **Η ΑΠΟΥΣΙΑ ΤΙΜΗΣ ΟΝΟΜΑΖΕΤΑΙ, ΔΕΝ ΣΒΗΝΕΤΑΙ** (ADR-777 Α6, κανόνας 9). Ένα κενό εκεί που περιμένεις ποσό
 * διαβάζεται ως «δωρεάν» ή ως βλάβη· το «δεν έχει καταχωρηθεί» είναι **υπαρκτή πληροφορία** και οδηγεί σε πράξη.
 *
 * 🔶 **Δεν υπάρχει οδός/πόλη πάνω στο `Property`** — η θέση εκφράζεται ως *κτίριο · έργο · όροφος*. Δεν
 * εφευρίσκεται διεύθυνση που η βάση δεν έχει.
 */

import React from 'react';

import { CardBadges } from '@/design-system/primitives/Card/CardBadges';
import {
  MISSING_PRICE_LABEL_KEYS,
  buildCardPriceText,
  buildListingAudienceBadge,
  buildPropertyStatusBadge,
} from '@/domain/cards/property/property-card-shared';
import type { GridCardBadge } from '@/design-system/components/GridCard/GridCard.types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

/** Ένα γεγονός της ταυτότητας: ετικέτα + τιμή. `<dl>` γιατί **είναι** ορισμοί. */
function IdentityFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  const colors = useSemanticColors();
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={`text-xs ${colors.text.muted}`}>{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

/** **Ο υπότιτλος της ταυτότητας**: κωδικός · είδος · κτίριο · έργο · όροφος. */
export function usePropertyIdentityLine(property: Property | null): string {
  const { t } = useTranslation(['properties', 'properties-enums']);
  const floorLabel = useFloorLabel();
  if (!property) return '';
  // Κενή εφεδρεία, όχι η ωμή τιμή (CHECK 3.97): άγνωστο είδος **παραλείπεται** από τη γραμμή, δεν εμφανίζεται ως
  // `apartment` που μοιάζει με δεδομένα και κρύβει το κλειδί που λείπει.
  const translatedType = t(`filters.types.${property.type}`, { defaultValue: '' });
  return [property.code, translatedType, property.building, property.project, floorLabel(property.floor)]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
}

/**
 * **Τα σήματα** δίπλα στον τίτλο: κατάσταση (ίδιο SSoT με την κάρτα πλέγματος) + **κοινό** της αγγελίας.
 *
 * 🔑 Το κοινό διαβάζεται από κάθε καρτέλα, όχι μόνο από την «Αγγελία» (§8.87.3) — και **σιωπά** όταν το ακίνητο
 * δεν διατίθεται (`buildListingAudienceBadge` ⇒ `null`): «Δημόσια» πάνω σε ακίνητο εκτός αγοράς θα ήταν ψέμα.
 */
export function PropertyIdentityStatus({ property }: { readonly property: Property }): React.ReactElement | null {
  // ⚠️ Τα namespaces του σήματος δηλώνονται **ρητά**: η εμπορική ετικέτα ζει στο `properties-enums`, η ετικέτα
  // κύκλου ζωής στο `trash` (`buildPropertyStatusBadge`). Αλλιώς θα δούλευε **επειδή κάποιος άλλος** τα έχει
  // φορτώσει — εξάρτηση από τη σειρά φόρτωσης, όχι από δήλωση (CHECK 3.36 §8.1).
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer', 'trash']);
  const badges = [buildPropertyStatusBadge(property, t), buildListingAudienceBadge(property, t)].filter(
    (badge): badge is GridCardBadge => badge !== null,
  );
  if (badges.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <CardBadges badges={badges} max={badges.length} />
    </span>
  );
}

/** **Τα γεγονότα της ταυτότητας**: τιμή (ή η ονομασμένη απουσία της) και εμβαδόν. */
export function PropertyIdentityFacts({ property }: { readonly property: Property }): React.ReactElement {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const colors = useSemanticColors();

  const price = resolveDisplayPrice(property);
  const priceText = buildCardPriceText(price, t);
  const displayArea = property.areas?.gross ?? property.areas?.net ?? property.area;

  return (
    // Μόνο λεπτή γραμμή από πάνω: το `quick.input` ζωγράφιζε πλήρες πλαίσιο πεδίου γύρω από δύο τιμές.
    <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-3">
      <IdentityFact label={t('properties-detail:card.stats.price')}>
        {/*
          ⚠️ Η διακλάδωση γίνεται στο `price.kind` και **όχι** στο `priceText`: το δεύτερο είναι *παράγωγο* του
          πρώτου, και ένας μελλοντικός τρίτος λόγος απουσίας θα περνούσε σιωπηλά από τον έλεγχο ενός `null`.
        */}
        {price.kind === 'missing' || priceText === null ? (
          <span className={colors.text.muted}>
            {t(
              `properties-detail:${
                price.kind === 'missing'
                  ? MISSING_PRICE_LABEL_KEYS[price.reason]
                  : MISSING_PRICE_LABEL_KEYS['not-listed']
              }`,
            )}
          </span>
        ) : (
          <>
            <span className={COLOR_BRIDGE.text.price}>{priceText.headline}</span>
            {priceText.secondary ? (
              <span className={`ml-2 text-xs font-normal ${colors.text.muted}`}>{priceText.secondary}</span>
            ) : null}
          </>
        )}
      </IdentityFact>

      {typeof displayArea === 'number' && displayArea > 0 ? (
        <IdentityFact label={t('properties-detail:card.stats.area')}>{displayArea} m²</IdentityFact>
      ) : null}
    </dl>
  );
}
