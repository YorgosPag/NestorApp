'use client';

/**
 * @fileoverview **«ΑΝΕΒΑΣΕ Ο,ΤΙ ΕΧΕΙΣ»** — φωτογραφίες και κατόψεις (Α14).
 * @related ADR-777 §7 (Α14 · Α19 κανόνας 31) · hooks/owner-property/useOwnerPropertyMedia
 * @module components/owner-property/form/OwnerPropertyMediaField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΠΟΦΑΣΗ ΤΗΣ Α14, ΚΑΤΑ ΛΕΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * > *«Όχι μόνο μια ξερή κάτοψη … να ανεβάζει φωτογραφίες, κατόψεις, **ό,τι έχει**,
 * > **αλλά να συμπληρώνει και φόρμα με δεδομένα** … Αλλά **δεν θα επιβάλουμε στον
 * > χρήστη να γίνει ειδικός του κλάδου**.»*
 *
 * Άρα το ανέβασμα είναι **προαιρετικό** και τα **πεδία** είναι ο πυρήνας (§17.1:
 * *«ακίνητο χωρίς πεδία είναι αόρατο στη μηχανή ταιριάσματος»*). Ένα υποχρεωτικό
 * αρχείο θα ήταν φράγμα σε ακριβώς αυτό που η Α14 άνοιξε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΑ ΑΡΧΕΙΑ ΕΙΝΑΙ **ΙΔΙΩΤΙΚΑ**, ΚΑΙ ΤΟ ΛΕΜΕ ΣΤΟΝ ΑΝΘΡΩΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **κανόνας 31** (Α19) απαγορεύει ρητά την εικόνα χρήστη ως πρώτο καρέ: *«παράγεται
 * ΑΠΟ ΤΟ ΜΟΝΤΕΛΟ, ποτέ από ανέβασμα χρήστη — αλλιώς **μπορεί να πει ψέματα**»*. Ο
 * κανόνας του Storage δίνει ανάγνωση **μόνο στον κάτοχο**, και το `PublicListing`
 * κρατά `coverImage: null`.
 *
 * 🔑 **Και η οθόνη το δηλώνει** (`media.privateNote`), αντί να το υπονοήσει. Ένας
 * άνθρωπος που ανεβάζει φωτογραφίες περιμένοντας να τις δει η αγορά και δεν συμβαίνει
 * τίποτα, **δεν έχει τρόπο να καταλάβει γιατί** — και θα το θεωρήσει βλάβη.
 */

import React from 'react';
import Link from 'next/link';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { FormFieldset } from '@/components/shared/forms/form-field-primitives';
import { useOwnerPropertyMedia } from '@/hooks/owner-property/useOwnerPropertyMedia';
import { hasDraftIdentity } from '@/lib/forms/draft-identity';
import { AUTH_ROUTES } from '@/lib/routes';
import type { OwnerPropertyFormValues } from '@/lib/owner-property/owner-property-form-values';

const NS = 'property-market';
const K = `${NS}:offer.media`;

export function OwnerPropertyMediaField({
  authorUserId,
  ownerPropertyId,
}: {
  authorUserId: string | null;
  ownerPropertyId: string;
}): React.ReactElement {
  const { t } = useTranslation([NS]);
  const form = useFormContext<OwnerPropertyFormValues>();
  const inputId = React.useId();
  const { state, upload } = useOwnerPropertyMedia(authorUserId, ownerPropertyId);

  /**
   * 🔴 **ΕΝΑ ΜΗΝΥΜΑ, ΔΥΟ ΣΚΑΝΔΑΛΕΣ** (ADR-660 §5.9) — και οι δύο χρειάζονται.
   *
   * Η **πρώτη** είναι *προληπτική*: ο άνθρωπος το μαθαίνει **πριν** διαλέξει αρχείο,
   * όπως ακριβώς η φόρμα δείχνει «τι λείπει» χωρίς να περιμένει υποβολή (Α14 §17.2).
   * Η **δεύτερη** είναι το *fail-closed* του ίδιου του ανεβάσματος: αν η ταυτότητα
   * χαθεί **ανάμεσα** στην απόδοση και στην επιλογή αρχείου (λήξη συνεδρίας), η
   * προληπτική δεν έχει προλάβει να εμφανιστεί.
   *
   * ⚠️ **Ένα `<p>`, όχι δύο**: είναι το **ίδιο γεγονός**. Δύο μηνύματα που λένε το
   * ίδιο πράγμα διαβάζονται ως δύο διαφορετικά προβλήματα.
   */
  const accountMissing = !hasDraftIdentity(authorUserId) || state.state === 'accountRequired';

  const media = form.watch('media') ?? [];

  async function handleFiles(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    // ⚠️ Το πεδίο αδειάζει **αμέσως**, ώστε το ίδιο αρχείο να μπορεί να ξαναεπιλεγεί
    // μετά από αποτυχία: ένα `<input type="file">` δεν πυροδοτεί `change` για ίδια τιμή.
    event.target.value = '';

    // ⚠️ **Σειριακά, όχι `Promise.all`**: η κατάσταση ανεβάσματος είναι **μία** και
    // δείχνει ένα όνομα αρχείου. Παράλληλα ανεβάσματα θα την έγραφαν το ένα πάνω στο
    // άλλο, και ο άνθρωπος θα έβλεπε ποσοστά που πηδάνε ανάμεσα σε δύο αρχεία.
    for (const file of files) {
      const uploaded = await upload(file);
      if (uploaded === null) continue;
      // 🔑 Διαβάζεται **η τρέχουσα** τιμή της φόρμας σε κάθε βήμα, όχι το `media` του
      // κλεισίματος: αλλιώς το δεύτερο αρχείο θα έσβηνε το πρώτο.
      form.setValue('media', [...(form.getValues('media') ?? []), uploaded], {
        shouldDirty: true,
      });
    }
  }

  function handleRemove(storagePath: string): void {
    // ⚠️ **Αφαιρείται από την αγγελία, ΔΕΝ σβήνεται από το Storage.** Η διαγραφή
    // αρχείου είναι μη αναστρέψιμη πράξη σε δεδομένο του ανθρώπου, ενώ αυτή η οθόνη
    // μπορεί να ακυρωθεί χωρίς αποθήκευση — μια «καθαριότητα» εδώ θα κατέστρεφε το
    // αρχείο ακόμη κι αν ο άνθρωπος πατούσε μετά «Ακύρωση».
    form.setValue(
      'media',
      (form.getValues('media') ?? []).filter((item) => item.storagePath !== storagePath),
      { shouldDirty: true },
    );
  }

  return (
    <FormFieldset legend={t(`${K}.label`)} help={t(`${K}.help`)}>
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="inline-block cursor-pointer rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
        >
          {t(`${K}.add`)}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          onChange={handleFiles}
          className="sr-only"
        />

        {state.state === 'uploading' && (
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {t(`${K}.uploading`, { fileName: state.fileName, percent: state.percent })}
          </p>
        )}
        {state.state === 'rejected' && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.rejected`, { fileName: state.fileName, reason: state.reason })}
          </p>
        )}
        {state.state === 'failed' && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.failed`, { fileName: state.fileName })}
          </p>
        )}
        {accountMissing && (
          <p aria-live="polite" className="text-sm text-foreground">
            {t(`${K}.accountRequired`)}{' '}
            {/*
              🔑 **Σύνδεσμος, ΟΧΙ διάλογος** (ADR-660 §5.10). Ένα `<form>` σύνδεσης
              φωλιασμένο μέσα σε αυτό το `<form>` είναι **άκυρο HTML**· και ο
              `AuthForm` είναι **οθόνη** (δικό της toolbar, σήμα, ανακατεύθυνση), όχι
              χειριστήριο πεδίου. Η φυγή είναι ασφαλής επειδή το προσχέδιο
              **επιβιώνει**: δες `owner-property-draft-memory.ts`.
            */}
            <Link href={AUTH_ROUTES.login} className="font-medium text-foreground underline">
              {t(`${K}.signIn`)}
            </Link>
          </p>
        )}

        {media.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${K}.empty`)}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {media.map((item) => (
              <li
                key={item.storagePath}
                className="flex items-center justify-between gap-3 text-sm text-foreground"
              >
                <span>{item.fileName}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.storagePath)}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground"
                >
                  {t(`${K}.remove`)}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-muted-foreground">{t(`${K}.privateNote`)}</p>
      </div>
    </FormFieldset>
  );
}
