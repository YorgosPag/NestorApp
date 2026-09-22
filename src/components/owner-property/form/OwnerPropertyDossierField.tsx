'use client';

/**
 * @fileoverview **«ΑΝΕΒΑΣΕ Ο,ΤΙ ΕΧΕΙΣ» — ΣΤΟΝ ΦΑΚΕΛΟ ΤΟΥ ΑΚΙΝΗΤΟΥ ΣΟΥ** (ADR-866 Φ1.3β · Α14).
 * @related ADR-866 §2.7.4 (η αγγελία δηλώνει, ο φάκελος κατέχει) · §2.11 · ADR-841 §7 Α2.7
 * @module components/owner-property/form/OwnerPropertyDossierField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΔΙΑΔΟΧΟΣ ΤΟΥ `OwnerPropertyMediaField` — ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το παλιό πεδίο κρατά **τέσσερις** απαντήσεις σε **ένα** πεδίο (`media[]`): *ποια αρχεία υπάρχουν · τι είναι το
 * καθένα · ποια φεύγουν · με ποια σειρά*. Εδώ οι τέσσερις **χώρισαν στους φυσικούς τους κατόχους** (§2.7.4):
 *
 * | Ερώτηση | Ποιος απαντά τώρα |
 * |---|---|
 * | ποια αρχεία υπάρχουν | ο **φάκελος** (`FileRecord` σε `files_personal`) — ζουν όσο το **σπίτι**, όχι όσο η αγγελία |
 * | τι είναι το καθένα | η **καρτέλα** του φακέλου (το κουμπί που πατήθηκε), ίδιες εμβέλειες με τη σελίδα του |
 * | ποια φεύγουν **και** με ποια σειρά | η **δήλωση** της αγγελίας (`publishedFileIds`) — **ανά αγγελία**, όχι ανά αρχείο |
 *
 * 🏆 **Εξυπνότερο από τους μεγάλους**: οι πύλες αντιγράφουν φωτογραφίες ανά αγγελία· εδώ **μία** αποθήκευση, και η
 * πώληση του 2026 με την ενοικίαση του 2028 δείχνουν **άλλες** φωτογραφίες από τον **ίδιο** φάκελο.
 *
 * ⚠️ **Η ΥΠΟΣΧΕΣΗ ΙΔΙΩΤΙΚΟΤΗΤΑΣ ΜΕΝΕΙ ΑΚΕΡΑΙΗ, ΚΑΙ ΕΝΙΣΧΥΕΤΑΙ**: αρχείο που **δεν** είναι στη δήλωση **δεν φεύγει**
 * (opt-in δομικά, χωρίς σημαία — §2.7.4). Και η οθόνη λέει πλέον **και** το δεύτερο μισό: τα αρχεία **μένουν στον
 * φάκελο** ακόμη κι αν η αγγελία αποσυρθεί. Μια οθόνη που το υπονοούσε θα ήταν η επόμενη «μπαγιάτικη υπόσχεση».
 */

import React from 'react';
import { Link } from '@/lib/workspace/navigation';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import { isLandProperty } from '@/constants/property-classification';
import { normalizePropertyType } from '@/constants/property-type-aliases';
import { hasDraftIdentity } from '@/lib/forms/draft-identity';
import { AUTH_ROUTES } from '@/lib/routes';
import { propertyDossierLabelFrom } from '@/types/property-dossier';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';
import type { FormDossier } from '@/hooks/owner-property/useOwnerPropertyDossierFiles';

import { OwnerPropertyDossierPanel } from './OwnerPropertyDossierPanel';

const NS = 'property-market';
const K = `${NS}:offer.media`;

export interface OwnerPropertyDossierFieldProps {
  readonly authorUserId: string | null;
  /** Η ταυτότητα `pdos_*` — προ-γεννημένη από τη φόρμα (δημιουργία) ή η δηλωμένη της αγγελίας (επεξεργασία). */
  readonly dossierId: string;
  /** `true` στην **επεξεργασία** αγγελίας που δηλώνει ήδη φάκελο ⇒ καμία γέννηση. */
  readonly dossierExists: boolean;
}

export function OwnerPropertyDossierField({
  authorUserId,
  dossierId,
  dossierExists,
}: OwnerPropertyDossierFieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();

  // 🔑 **Ο ίδιος κριτής με τους αδελφούς του** (`isLandProperty`) — ένα οικόπεδο δεν έχει κάτοψη, έχει τοπογραφικό.
  const rawType = form.watch('type');
  const isLand = isLandProperty(rawType);

  /**
   * 🔴 **ΤΟ ΟΝΟΜΑ ΤΟΥ ΦΑΚΕΛΟΥ ΕΙΝΑΙ ΣΤΟΙΧΕΙΟ ΔΕΔΟΜΕΝΩΝ, ΚΑΙ ΓΙ' ΑΥΤΟ ΓΕΝΝΙΕΤΑΙ ΕΔΩ** (N.11).
   *
   * Το «Ακίνητο χωρίς όνομα» είναι το «Untitled document» του Google Docs: **γράφεται στον φάκελο** και ο άνθρωπος
   * το βλέπει στο «Οι φάκελοί μου» — δεν είναι ετικέτα οθόνης. Άρα ζει στο locale (**ο πελάτης** ξέρει τη γλώσσα
   * του), ποτέ στον διακομιστή: το {@link propertyDossierLabelFrom} το γράφει ρητά ότι *«εδώ δεν επινοείται κείμενο»*.
   *
   * ⚠️ Ο τίτλος διαβάζεται **τη στιγμή της γέννησης** (πρώτο ανέβασμα), όχι στο άνοιγμα — γι' αυτό το `dossier`
   * ξαναχτίζεται σε κάθε πληκτρολόγηση και ο hook κρατά **την τελευταία** όψη του.
   */
  const label = propertyDossierLabelFrom(form.watch('title')) || t(`${K}.dossier.untitled`);

  const dossier: FormDossier | null = hasDraftIdentity(authorUserId)
    ? {
        id: dossierId,
        userId: authorUserId,
        label,
        // 🔑 **Αντιγραφή, όχι μετάφραση** (§2.11.2 Δ7): ο φάκελος κρατά το **ίδιο** λεξιλόγιο είδους με την αγγελία.
        type: normalizePropertyType(rawType),
        existsOnServer: dossierExists,
      }
    : null;

  return (
    <FormFieldset
      legend={t(isLand ? `${K}.landLabel` : `${K}.label`)}
      help={t(isLand ? `${K}.landHelp` : `${K}.help`)}
    >
      <div className="flex flex-col gap-2">
        {dossier === null ? (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.accountRequired`)}{' '}
            {/* 🔑 Σύνδεσμος, ΟΧΙ διάλογος (ADR-660 §5.10): `<form>` μέσα σε `<form>` είναι άκυρο HTML, και το
                προσχέδιο **επιβιώνει** της φυγής — μαζί με την ταυτότητα του φακέλου (draft memory έκδοση 2). */}
            <Link href={AUTH_ROUTES.login} className="font-medium text-foreground underline">
              {t(`${K}.signIn`)}
            </Link>
          </p>
        ) : (
          <OwnerPropertyDossierPanel dossier={dossier} isLand={isLand} />
        )}

        <p className="text-sm text-muted-foreground">{t(`${K}.privateNote`)}</p>
        <p className="text-sm text-muted-foreground">{t(`${K}.dossier.keptNote`)}</p>
      </div>
    </FormFieldset>
  );
}
