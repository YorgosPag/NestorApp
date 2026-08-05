'use client';

/**
 * @fileoverview **Καταχώριση επαφής χωρίς έξοδο από το σχέδιο** (ADR-759 §4.5, Άξονας Γ).
 *
 * Πριν: `no-match` ⇒ ο μηχανικός έφευγε στις Επαφές, πληκτρολογούσε ξανά ό,τι το σχέδιο ήδη
 * γνώριζε, γύριζε, ξαναδιάβαζε το DXF. Τώρα: **ένα κλικ**, φόρμα ήδη γεμάτη, και η πρόταση
 * ξαναγεννιέται.
 *
 * ## 🔑 Ούτε μία γραμμή φόρμας επαφής δεν γράφτηκε εδώ — και αυτό είναι το σχέδιο
 *
 * Ανοίγει το **κανονικό** `TabbedAddNewContactDialog`. Άρα ισχύουν αυτούσια: το enterprise id
 * (N.6), η επικύρωση, οι φύλακες σύγκρουσης, οι ειδοποιήσεις, η κανονική διαδρομή εγγραφής
 * (`createContactWithPolicy`) και το πρωτόκολλο πληκτρολογίου των modal (ADR-711 — ο καμβάς
 * παραιτείται από τους ~43 accelerators του όσο η φόρμα είναι ανοιχτή, αλλιώς κάθε
 * πληκτρολόγηση θα ενεργοποιούσε εργαλείο σχεδίασης). Μια «μικρή, γρήγορη» φόρμα εδώ θα ήταν
 * sibling clone (N.18) που θα έχανε **και τα έξι**.
 *
 * ## 🔴 Δημιουργία ≠ ταυτοποίηση
 *
 * Η νέα επαφή **δεν** εγκρίνει το binding (ADR-745 §8 κανόνας 1, ADR-759 §4.5). Μετά την
 * αποθήκευση καλείται το `onCreated`, που **ξαναδιαβάζει τη βάση και ξαναπερνά από τον ίδιο
 * Λ2** — δεν μαντεύουμε `contactId`. Αν το ταίριασμα δεν βγει, η γραμμή μένει `no-match` και
 * φαίνεται· ένα σιωπηλό «τα κατάφερα» θα ήταν χειρότερο από την αποτυχία.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/TitleBlockContactCreation
 */

import React, { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { UserPlus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { buildContactPrefill, type ProposalPerson } from '@/lib/title-block/contact-prefill';
import type { ContactType } from '@/types/contacts';
import { TitleBlockPrefillNotice } from './TitleBlockPrefillNotice';

/**
 * 🔴 **Τεμπέλικο εκ ανάγκης, όχι από ευγένεια — μετρημένο 2026-08-05.**
 *
 * Με **στατική** εισαγωγή, η αλυσίδα είναι: γραμμή πρότασης → φόρμα επαφής →
 * `UnifiedContactTabbedSection` → `AddressesSectionWithFullscreen` → `ContactAddressMapPreview`
 * → `AddressMap` → **`maplibre-gl`**. Δηλαδή το άνοιγμα ενός τοπογραφικού θα κατέβαζε
 * ολόκληρη τη φόρμα επαφών **και μια μηχανή χαρτών** — για ένα κουμπί που ο μηχανικός μπορεί
 * να μην πατήσει ποτέ.
 *
 * Δεν ήταν πρόβλεψη: το `title-block-write-spy.test.tsx` **έσκασε στο φόρτωμα** μόλις μπήκε η
 * στατική εισαγωγή (`maplibre-gl` δεν ζει σε jsdom). Το test το βρήκε επειδή ρωτά την ίδια
 * ερώτηση με τον bundler — «τι σέρνει αυτό το αρχείο;».
 *
 * `ssr: false` γιατί η φόρμα είναι καθαρά διαδραστική, όπως και οι διάλογοι του `SalesSidebar`.
 */
const TabbedAddNewContactDialog = dynamic(
  () =>
    import('@/components/contacts/dialogs/TabbedAddNewContactDialog').then((m) => ({
      default: m.TabbedAddNewContactDialog,
    })),
  { ssr: false },
);

/**
 * Ένα πρόσωπο πινακίδας είναι **πρόσωπο**. Κλειδώνοντας τον τύπο, ο επιλογέας «Φυσικό /
 * Εταιρεία / Υπηρεσία» δεν αποδίδεται καν — μια απόφαση λιγότερη σε ροή που υπάρχει για να
 * γλιτώσει αποφάσεις.
 */
const INDIVIDUAL_ONLY: ContactType[] = ['individual'];

interface Props {
  readonly subject: ProposalPerson;
  /** Καλείται **μετά** την αποθήκευση — ζητά επαναϋπολογισμό, δεν δηλώνει επιτυχία. */
  readonly onCreated: () => void;
  readonly disabled: boolean;
}

export const TitleBlockContactCreation: React.FC<Props> = ({ subject, onCreated, disabled }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);

  // `useMemo`: το `prefill` είναι **εξάρτηση effect** μέσα στον διάλογο. Νέο αντικείμενο σε κάθε
  // απόδοση θα ξαναέσπερνε τη φόρμα συνεχώς, σβήνοντας ό,τι πληκτρολογεί ο άνθρωπος.
  const prefill = useMemo(
    () => buildContactPrefill(subject.person, subject.everyone),
    [subject.person, subject.everyone],
  );

  const notice = useMemo(() => <TitleBlockPrefillNotice prefill={prefill} />, [prefill]);

  const handleContactAdded = useCallback(() => {
    setCreated(true);
    onCreated();
  }, [onCreated]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 h-7"
        disabled={disabled}
        title={t('titleBlockBinding.newContact.buttonTitle')}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="mr-1 size-3" aria-hidden />
        {t('titleBlockBinding.createContact')}
      </Button>

      {/* 🔑 **Πότε ΦΑΙΝΕΤΑΙ πραγματικά αυτό το μήνυμα.** Όταν ο επαναϋπολογισμός πετύχει, η
          γραμμή αποκτά υποψήφιο, ο κλάδος `no-match` χάνεται και ολόκληρο αυτό το component
          αποπροσαρτάται — ο άνθρωπος βλέπει το αποτέλεσμα, όχι μια υπόσχεση. Άρα το κείμενο
          επιβιώνει **ακριβώς** σε δύο καταστάσεις: όσο τρέχει η ανάγνωση, και όταν το
          ταίριασμα **δεν βγήκε**. Γι' αυτό λέει τι να κοιτάξει σε εκείνη την περίπτωση: ο
          §4.5 κανόνας 2 απαιτεί η αποτυχία να **φαίνεται**, όχι να σιωπά. */}
      {created ? (
        <p role="status" className="mt-1 text-[11px] text-muted-foreground">
          {t('titleBlockBinding.newContact.createdStillUnapproved')}
        </p>
      ) : null}

      {/* Αποδίδεται **μόνο** ανοιχτός: το `TabbedAddNewContactDialog` κρατά προ-παραγμένο
          enterprise id σε `useState` αρχικοποιητή, οπότε ένα μόνιμα προσαρτημένο αντίγραφο ανά
          γραμμή θα δέσμευε ένα id για κάθε πρόταση κάθε φορά που ανοίγει η παλέτα. */}
      {open ? (
        <TabbedAddNewContactDialog
          open
          onOpenChange={setOpen}
          onContactAdded={handleContactAdded}
          allowedContactTypes={INDIVIDUAL_ONLY}
          prefill={prefill.formData}
          prefillNotice={notice}
        />
      ) : null}
    </>
  );
};
