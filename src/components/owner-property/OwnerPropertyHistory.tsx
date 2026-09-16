'use client';

/**
 * @fileoverview **ΤΟ ΙΣΤΟΡΙΚΟ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ποιος άλλαξε τι, πότε (ADR-864 Φ1β · ADR-195).
 * @module components/owner-property/OwnerPropertyHistory
 *
 * 🔑 **ΕΝΑ component, ΔΥΟ σπίτια**: η σελίδα του κατόχου (`(me)/offers/[offerId]`) και η σελίδα
 * της εντολής στο γραφείο (`(app)/o/[workspace]/listings/mandates/[ownerPropertyId]`). Και τα δύο
 * δείχνουν το **ίδιο** ιστορικό με τον **ίδιο** αναγνώστη (`ActivityTab`) — αλλάζει μόνο **ποιο
 * βιβλίο** ανοίγει, και αυτό **δεν το διαλέγει η οθόνη**: το παράγει η θεματοφυλακή της αγγελίας
 * (`custodyOf`), η ίδια που αποφάσισε σε ποιο βιβλίο **γράφτηκε** η εγγραφή.
 *
 * ⚠️ **Γιατί όχι «ο χώρος της οθόνης»**: ένας μεσίτης βλέπει στον **ιδιωτικό** του χώρο και
 * αγγελίες που κατέγραψε για το γραφείο. Αν το βιβλίο ερχόταν από την οθόνη, θα άνοιγε το
 * προσωπικό βιβλίο για εγγραφές που ζουν στο εταιρικό — **άδειο ιστορικό που λέει ψέματα**.
 *
 * 🏆 Πρότυπο: ιστορικό εκδόσεων Figma / Google Docs (δίπλα στο έγγραφο, όχι σε σελίδα διαχείρισης)
 * · ιστορικό τιμής Zillow (η αλλαγή τιμής ανά διάθεση είναι γραμμή, όχι «άλλαξε η αγγελία»).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { auditLedgerKindOf, type AuditLedgerKind } from '@/lib/audit/audit-ledger';
import { custodyOf, custodyWorkspace } from '@/lib/owner-property/listing-custody';
import type { OwnerProperty } from '@/types/owner-property';

/**
 * 🔴 **LAZY, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ ΑΝΑΓΚΗ — ΟΧΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ** (ADR-744, CHECK 3.34). Με στατική
 * εισαγωγή το χρονολόγιο ιστορικού έμπαινε στη **στατική κλειστότητα** της `/offers/[offerId]`: ο
 * γεννήτορας του slice βρήκε **δυναμικά `t()`** (`AuditTimelineView`: ετικέτες πεδίων που λύνονται
 * τη στιγμή της απόδοσης) και **αρνήθηκε** να εκπέμψει slice — 43.729 bytes ως κάτω φράγμα.
 * Ίδιο πρότυπο με το `PurchaseOrderDetail`. Ο **τίτλος** και η **επεξήγηση** μένουν σύγχρονα
 * (ζουν σε αυτό το αρχείο), ώστε η ενότητα να μην ξεκινά ποτέ με ωμό κλειδί (CHECK 3.51).
 */
const ActivityTab = React.lazy(() =>
  import('@/components/shared/audit/ActivityTab').then((m) => ({ default: m.ActivityTab })),
);

const NS = 'property-market';
const HEADING_ID = 'owner-property-history-heading';

/**
 * **Ποιος το βλέπει** — λέγεται ρητά, γιατί είναι η απάντηση στο πρώτο ερώτημα κάθε ιδιώτη
 * («θα το δει ο μεσίτης;»). Ρητός χάρτης, όχι σύνθεση κλειδιού: κάθε κλειδί **γράφεται** εδώ,
 * ώστε ο έλεγχος προσβασιμότητας i18n (CHECK 3.13) να το βλέπει.
 */
const LEAD_KEY: Readonly<Record<AuditLedgerKind, string>> = {
  personal: `${NS}:offer.history.lead.personal`,
  company: `${NS}:offer.history.lead.company`,
};

type CustodyFields = Pick<OwnerProperty, 'id' | 'authorUserId' | 'authorCompanyId'>;

export function OwnerPropertyHistory({ property }: { readonly property: CustodyFields }): React.ReactElement {
  const { t } = useTranslation([NS]);
  const ledger = auditLedgerKindOf(custodyWorkspace(custodyOf(property)));

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-2">
      <header>
        <h2 id={HEADING_ID} className="m-0 text-base font-semibold text-foreground">
          {t(`${NS}:offer.history.title`)}
        </h2>
        <p className="m-0 text-sm text-muted-foreground">{t(LEAD_KEY[ledger])}</p>
      </header>
      <React.Suspense
        fallback={<p className="m-0 text-sm text-muted-foreground">{t(`${NS}:offer.history.loading`)}</p>}
      >
        <ActivityTab entityType="owner_property" entityId={property.id} ledger={ledger} />
      </React.Suspense>
    </section>
  );
}
