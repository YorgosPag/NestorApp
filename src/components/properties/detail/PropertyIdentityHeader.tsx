'use client';

/**
 * @fileoverview **ΤΑΥΤΟΤΗΤΑ ΜΕ ΜΙΑ ΜΑΤΙΑ** — «κοιτάω το σωστό ακίνητο;»
 * @related ADR-777 §8.30 · §7 (Α6: η τιμή φαίνεται) · lib/properties/price-resolver
 * @module components/properties/detail/PropertyIdentityHeader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΑΠΑΝΤΑ ΑΛΛΟ ΕΡΩΤΗΜΑ ΑΠΟ ΤΟ `PropertyQuickView` — ΓΙ' ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΕΚΕΙΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PropertyQuickView` (ADR-258D) απαντά *«ποια είναι τα στοιχεία αυτού του
 * ακινήτου;»* σε αιωρούμενη κάρτα πλάτους ~250px: **δεκατρείς** σειρές, `text-xs`,
 * γιατί εκεί ο άνθρωπος **δεν** έχει άλλη πηγή. Εδώ το ερώτημα είναι *«κοιτάω το
 * σωστό ακίνητο;»* — και η πλήρης απάντηση ζει **δύο εκατοστά πιο κάτω**, στην
 * καρτέλα «Πληροφορίες». Μια δεύτερη πλήρης λίστα από πάνω της δεν θα ήταν SSoT,
 * θα ήταν **η ίδια πληροφορία δύο φορές στην ίδια οθόνη**.
 *
 * 🔑 **ΚΑΜΙΑ ΤΙΜΗ ΔΕΝ ΜΕΤΑΦΡΑΖΕΤΑΙ ΔΕΥΤΕΡΗ ΦΟΡΑ.** Ό,τι *σημαίνει* κάτι έρχεται
 * από το ίδιο SSoT με την κάρτα πλέγματος: `resolveDisplayPrice` (ποια τιμή) ·
 * `buildCardPriceText` (πώς λέγεται) · `MISSING_PRICE_LABEL_KEYS` (πώς λέγεται η
 * **απουσία** της) · `resolvePropertyBadge` (ποια κατάσταση) · `formatFloorLabel`.
 * Εδώ ζει **μόνο** η διάταξη.
 *
 * ⚠️ **Η ΑΠΟΥΣΙΑ ΤΙΜΗΣ ΟΝΟΜΑΖΕΤΑΙ, ΔΕΝ ΣΒΗΝΕΤΑΙ** (ADR-777 Α6, κανόνας 9). Ένα
 * κενό εκεί που περιμένεις ποσό διαβάζεται ως «δωρεάν» ή ως βλάβη· το «δεν έχει
 * καταχωρηθεί» είναι **υπαρκτή πληροφορία** και οδηγεί σε πράξη.
 *
 * 🔶 **Δεν υπάρχει οδός/πόλη πάνω στο `Property`** — η θέση εκφράζεται ως *κτίριο ·
 * έργο · όροφος*. Δεν εφευρίσκεται διεύθυνση που η βάση δεν έχει.
 */

import React from 'react';

import { PropertyBadge } from '@/core/badges';
import {
  MISSING_PRICE_LABEL_KEYS,
  buildCardPriceText,
  resolvePropertyBadge,
} from '@/domain/cards/property/property-card-shared';
import { usePropertyThumbnail } from '@/features/property-grid/hooks/usePropertyThumbnail';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatFloorLabel } from '@/lib/intl-utils';
import { resolveDisplayPrice } from '@/lib/properties/price-resolver';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { Property } from '@/types/property-viewer';
import '@/lib/design-system';

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

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

export function PropertyIdentityHeader({
  property,
}: {
  readonly property: Property;
}): React.ReactElement {
  // ⚠️ Το `common` δηλώνεται **ρητά**: η ετικέτα κατάστασης ζει εκεί
  // (`UNIFIED_STATUS_FILTER_LABELS`). Η κάρτα πλέγματος τη ζητά χωρίς να το
  // δηλώσει και δουλεύει **επειδή κάποιος άλλος** το έχει φορτώσει — εξάρτηση από
  // τη σειρά φόρτωσης, όχι από δήλωση (CHECK 3.36 §8.1).
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer', 'common']);
  const colors = useSemanticColors();
  const { radius, quick } = useBorderTokens();
  const thumbnailUrl = usePropertyThumbnail(property.id);

  const { badgeStatus, labelKey } = resolvePropertyBadge(property.commercialStatus, property.status);
  const price = resolveDisplayPrice(property);
  const priceText = buildCardPriceText(price, t);
  const displayArea = property.areas?.gross ?? property.areas?.net ?? property.area;
  const translatedType = t(`filters.types.${property.type}`, { defaultValue: property.type });

  const place = [property.building, property.project, formatFloorLabel(property.floor)]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-start ${colors.bg.card} ${radius.xl} ring-1 ${colors.border.muted} p-4`}
    >
      {/*
        Η φωτογραφία είναι **διακοσμητική** εδώ: ό,τι λέει το κάδρο το λένε ήδη ο
        τίτλος και τα γεγονότα δίπλα. Γι' αυτό `alt=""` — ένας αναγνώστης οθόνης
        που θα διάβαζε «φωτογραφία του Δ3» αμέσως πριν από το «Δ3» θα το έλεγε
        δύο φορές. Και όταν λείπει, δεν κατεβαίνει εικόνα-κράτηση από τρίτο
        διακομιστή: το εικονίδιο της οντότητας λέει την ίδια απουσία, δωρεάν.
      */}
      <figure className={`m-0 shrink-0 overflow-hidden ${radius.lg} ${colors.bg.muted} h-32 w-full sm:w-48`}>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <PropertyIcon className={`h-10 w-10 ${colors.text.muted}`} aria-hidden="true" />
          </span>
        )}
      </figure>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-xl font-semibold text-foreground">{property.name}</h1>
            <p className={`text-sm ${colors.text.muted}`}>
              {property.code ? `${property.code} · ` : ''}
              {translatedType}
              {place ? ` · ${place}` : ''}
            </p>
          </div>
          <PropertyBadge
            status={badgeStatus}
            variant="outline"
            customLabel={t(labelKey, { ns: 'common' })}
          />
        </div>

        <dl className={`flex flex-wrap gap-x-8 gap-y-3 border-t ${quick.input} pt-3`}>
          <IdentityFact label={t('properties-detail:card.stats.price')}>
            {/*
              ⚠️ Η διακλάδωση γίνεται στο `price.kind` και **όχι** στο `priceText`:
              το δεύτερο είναι *παράγωγο* του πρώτου, και ένας μελλοντικός τρίτος
              λόγος απουσίας θα περνούσε σιωπηλά από τον έλεγχο ενός `null`.
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
                  <span className={`ml-2 text-xs font-normal ${colors.text.muted}`}>
                    {priceText.secondary}
                  </span>
                ) : null}
              </>
            )}
          </IdentityFact>

          {typeof displayArea === 'number' && displayArea > 0 ? (
            <IdentityFact label={t('properties-detail:card.stats.area')}>
              {displayArea} m²
            </IdentityFact>
          ) : null}
        </dl>
      </div>
    </header>
  );
}
