'use client';

/**
 * @fileoverview **«Από την κατασκευάστρια · ετοιμάζεται»** — η προέλευση ενός φακέλου που ήρθε από παράδοση πώλησης.
 * @related ADR-916 Φ-Β2 · Δ10 · ADR-866 (`PropertyDossier.origin`) · `PropertyDossierCard` · `PropertyDossierDetailContent`
 * @module components/property-dossier/PropertyDossierOrigin
 *
 * 🔑 **Διαβάζει ΜΟΝΟ τον φάκελο** (`origin.handoverLifecycle` — προβολή που γράφει ο ένας γραφέας της παράδοσης).
 * ⛔ **ΠΟΤΕ** ανάγνωση `property_handovers` από τον πελάτη (Δ10): κρατά και τους συνιδιοκτήτες.
 * 🔑 **Η κατάσταση λέγεται με ΛΕΞΗ**, το χρώμα του σήματος μόνο συνοδεύει (CHECK 3.41).
 * ⚠️ `issuerName` = στιγμιότυπο της αποδοχής — ο φάκελος ζει και μετά το κλείσιμο της εταιρείας.
 */

import React from 'react';

import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PropertyDossierOrigin } from '@/types/property-dossier';
import type { PropertyHandoverLifecycle } from '@/types/property-handover';

const NS = 'property-market';

const LIFECYCLE_KEY: Readonly<Record<PropertyHandoverLifecycle, string>> = {
  'awaiting-completion': 'property-market:dossier.origin.lifecycle.awaiting-completion',
  ready: 'property-market:dossier.origin.lifecycle.ready',
  cancelled: 'property-market:dossier.origin.lifecycle.cancelled',
};

/** Τι σημαίνει η κατάσταση **για τον άνθρωπο** — μόνο στη σελίδα του φακέλου. */
const LIFECYCLE_EXPLAIN_KEY: Readonly<Record<PropertyHandoverLifecycle, string>> = {
  'awaiting-completion': 'property-market:dossier.origin.explain.awaiting-completion',
  ready: 'property-market:dossier.origin.explain.ready',
  cancelled: 'property-market:dossier.origin.explain.cancelled',
};

const LIFECYCLE_VARIANT: Readonly<Record<PropertyHandoverLifecycle, NonNullable<BadgeVariantProps['variant']>>> = {
  'awaiting-completion': 'info',
  ready: 'success',
  cancelled: 'muted',
};

function OriginLine({ origin }: { readonly origin: PropertyDossierOrigin }) {
  const { t } = useTranslation([NS]);
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>
        {origin.issuerName === null
          ? t('property-market:dossier.origin.fromUnnamed')
          : t('property-market:dossier.origin.from', { issuer: origin.issuerName })}
      </span>
      <Badge variant={LIFECYCLE_VARIANT[origin.handoverLifecycle]}>{t(LIFECYCLE_KEY[origin.handoverLifecycle])}</Badge>
    </p>
  );
}

/** Στην κάρτα της λίστας: μία γραμμή — ποιος και πού βρίσκεται. `null` προέλευση ⇒ τίποτα (φάκελος του ίδιου). */
export function PropertyDossierOriginLine({ origin }: { readonly origin: PropertyDossierOrigin | null }): React.ReactElement | null {
  return origin === null ? null : <OriginLine origin={origin} />;
}

/** Στη σελίδα του φακέλου: η ίδια γραμμή + τι σημαίνει τώρα. */
export function PropertyDossierOriginNotice({ origin }: { readonly origin: PropertyDossierOrigin | null }): React.ReactElement | null {
  const { t } = useTranslation([NS]);
  if (origin === null) return null;
  return (
    <aside className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 p-3">
      <OriginLine origin={origin} />
      <p className="m-0 text-sm text-foreground">{t(LIFECYCLE_EXPLAIN_KEY[origin.handoverLifecycle])}</p>
    </aside>
  );
}
