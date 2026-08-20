'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΟΥ ΓΡΑΦΕΙΟΥ** — «νέα αγγελία για πελάτη».
 * @related ADR-777 §8.33 · components/owner-property/OwnerPropertyFormContent.tsx
 * @module components/mandate/BrokeredListingPageContent
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ — ΚΑΙ ΤΙ **ΔΕΝ** ΞΑΝΑΓΡΑΦΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κρατά **μόνο** την κατάσταση της **εντολής** και τη λίστα επαφών. Τα πεδία του
 * ακινήτου, η επικύρωση, το κουμπί, η λίστα «τι λείπει» και η υποβολή είναι **το ίδιο
 * αρχείο** που εξυπηρετεί τον ιδιώτη — αλλάζει *ποιανού είναι*, όχι *τι είναι*.
 *
 * ⚠️ **Η λίστα επαφών ζητιέται μία φορά, στο άνοιγμα.** Ένα αντιδραστικό abonnement
 * εδώ θα ξαναποδίδαμε τη φόρμα κάθε φορά που κάποιος συνάδελφος αγγίζει επαφή — και η
 * φόρμα κρατά **μισοσυμπληρωμένη δουλειά** του μεσίτη.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { BrokeredMandateFields } from '@/components/mandate/BrokeredMandateFields';
import { OwnerPropertyFormContent } from '@/components/owner-property/OwnerPropertyFormContent';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { nowISO } from '@/lib/date-local';
import {
  emptyMandateForm,
  mandateFormBlockers,
  mandateRequestFrom,
  type MandateFormValues,
} from '@/lib/mandate/mandate-form-values';
import { getAllContacts } from '@/services/contacts-query.service';
import type { BrokeredNotifyOutcome } from '@/services/owner-property/owner-property.service';
import { getContactDisplayName } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

const NS = 'search-results';
const K = `${NS}:mandate.office`;

const logger = createModuleLogger('BrokeredListingPageContent');

/**
 * Πόσες επαφές κατεβαίνουν στον επιλογέα.
 *
 * ⚠️ **Δηλώνεται ρητά αντί να κληρονομηθεί η προεπιλογή** (`BATCH_SIZE`, **100**): ο
 * επιλογέας είναι **αναζήτηση σε τοπική λίστα**, οπότε ό,τι δεν κατέβηκε **δεν
 * βρίσκεται** — και ένα γραφείο με 150 επαφές θα έψαχνε τον 120ό πελάτη του χωρίς
 * ποτέ να μάθει γιατί δεν εμφανίζεται.
 *
 * 🔶 **Δηλωμένο όριο**: πάνω από αυτό ο επιλογέας θέλει **αναζήτηση στον διακομιστή**
 * (το `searchContacts` υπάρχει ήδη), όχι μεγαλύτερο νούμερο εδώ.
 */
const CLIENT_PICKER_LIMIT = 500;

export function BrokeredListingPageContent(): React.ReactElement {
  const { t } = useTranslation([NS]);

  // 🔑 **Αρχικοποιητής συνάρτησης**: το ρολόι διαβάζεται σε **μία** απόδοση. Ένα
  // `useState(emptyMandateForm(nowISO()))` θα υπολόγιζε νέα προεπιλεγμένη λήξη σε
  // κάθε απόδοση (πετώντας το αποτέλεσμα) — δουλειά χωρίς καταναλωτή.
  const [mandate, setMandate] = React.useState<MandateFormValues>(() =>
    emptyMandateForm(nowISO()),
  );
  const [clients, setClients] = React.useState<readonly ComboboxOption[]>([]);
  const [notify, setNotify] = React.useState<BrokeredNotifyOutcome | null>(null);

  React.useEffect(() => {
    let alive = true;
    // 🔴 **ΤΟ `getAllContacts` ΔΕΝ ΕΠΙΣΤΡΕΦΕΙ ΠΙΝΑΚΑ** — επιστρέφει σελίδα:
    // `{ contacts, lastDoc, nextCursor }`. Η πρώτη γραφή έκανε `.map()` πάνω στο
    // αντικείμενο και έσκαγε με «contacts.map is not a function».
    //
    // ⚠️ **Το βρήκε η ΟΘΟΝΗ, όχι πύλη και όχι άγκυρα** (μάθημα Μ-Η) — και έγινε ορατό
    // **μόνο** επειδή το `.catch()` παρακάτω **λέει** την αποτυχία. Μια σιωπηλή
    // αποτυχία εδώ θα έδινε **κενή λίστα επαφών**, που φαίνεται ταυτόσημη με «δεν
    // έχεις επαφές»: ο μεσίτης θα έψαχνε τον πελάτη του σε λίστα που δεν φορτώθηκε
    // ποτέ, και θα κατηγορούσε τα δεδομένα του.
    void getAllContacts({ limitCount: CLIENT_PICKER_LIMIT })
      .then(({ contacts }) => {
        if (!alive) return;
        setClients(
          contacts.map((contact) => ({
            value: contact.id,
            label: getContactDisplayName(contact),
          })),
        );
      })
      .catch((error: unknown) => {
        // ⚠️ **Η αποτυχία λέγεται, δεν σιωπά.** Μια κενή λίστα επαφών φαίνεται
        // ταυτόσημη με «δεν έχεις επαφές», και ο μεσίτης θα έψαχνε τον πελάτη του σε
        // λίστα που δεν φορτώθηκε ποτέ.
        logger.error('Οι επαφές δεν φορτώθηκαν για τον επιλογέα πελάτη', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">{t(`${K}.newTitle`)}</h1>
        <p className="text-sm text-muted-foreground">{t(`${K}.newSubtitle`)}</p>
      </header>

      {notify !== null && (
        <p
          role="status"
          className={
            notify.kind === 'sent'
              ? 'text-sm text-muted-foreground'
              : 'text-sm font-medium text-destructive'
          }
        >
          {notify.kind === 'sent'
            ? t(`${K}.notify.sent`, { to: notify.to })
            : t(`${K}.notify.${notify.kind}`)}
        </p>
      )}

      <OwnerPropertyFormContent
        mandate={{
          section: (
            <BrokeredMandateFields
              values={mandate}
              clients={clients}
              onChange={setMandate}
            />
          ),
          blockers: mandateFormBlockers(mandate),
          request: mandateRequestFrom(mandate),
          onNotify: (outcome) => setNotify(outcome ?? { kind: 'failed' }),
        }}
      />
    </section>
  );
}
