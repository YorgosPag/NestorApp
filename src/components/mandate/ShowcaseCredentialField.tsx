'use client';

/**
 * @fileoverview **ΜΙΑ ΕΙΔΙΚΟΤΗΤΑ, ΚΑΙ ΤΑ ΠΕΔΙΑ ΠΟΥ ΤΗΣ ΑΝΗΚΟΥΝ** — κατά ετυμηγορία.
 * @related ADR-841 Φ6-Β4 · Α9.1 · Α9.3 · config/isco-registry-authority.ts
 * @module components/mandate/ShowcaseCredentialField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΦΟΡΜΑ ΡΩΤΑ ΤΟ ΕΠΑΓΓΕΛΜΑ, ΟΧΙ ΤΟΝ ΑΝΘΡΩΠΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα σκέτο πεδίο *«αριθμός μητρώου»* θα ήταν μία γραμμή λιγότερη και **τρία**
 * λάθη: (α) θα ζητούσε αριθμό από τον **ελαιοχρωματιστή**, που δεν έχει πού να
 * γραφτεί — κάνοντας την απουσία μητρώου να **μοιάζει με έλλειψη** *(Α9.3)*·
 * (β) θα άφηνε τον **δικηγόρο** να γράψει «1234» χωρίς «ΔΣΘ», αριθμό που
 * **κανείς δεν μπορεί να επαληθεύσει** *(Α9.1)*· (γ) θα άφηνε τον άνθρωπο να
 * διαλέξει **αρχή**, δηλαδή θα επέτρεπε σε διακοσμητή να δηλώσει ΓΕΜΗ.
 *
 * | ετυμηγορία | Τι δείχνει |
 * |---|---|
 * | `authority` | **ένα** πεδίο αριθμού, με την αρχή **ονομασμένη και κλειδωμένη** (+ εκδότης αν έχει παραρτήματα) |
 * | `no-registry` | **κανένα πεδίο**: *«Δεν τηρείται μητρώο. **Δεν σας λείπει τίποτα.**»* |
 * | `unexamined` | **κανένα πεδίο**: *«Δεν **έχουμε εξετάσει**…»* — υποκείμενο **εμείς** |
 *
 * 🔑 **Η ετυμηγορία υπολογίζεται από την ΙΔΙΑ συνάρτηση που ρωτά ο γραφέας**
 * (`resolveRegistryAuthority`). Δεύτερος πίνακας εδώ θα σήμαινε φόρμα που ζητά
 * πεδίο το οποίο ο διακομιστής **πετά**, ή που δεν το ζητά ενώ εκείνος το
 * **απαιτεί** — και η δεύτερη εκδοχή είναι αδιέξοδο χωρίς μήνυμα.
 *
 * ⚠️ **Η ΦΟΡΜΑ ΔΕΝ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ.** Ο γραφέας αρνείται ονομαστικά· εδώ ζει
 * μόνο *«τι έχει νόημα να ρωτηθεί»*. Δύο κριτές για το ίδιο ερώτημα θα
 * απέκλιναν (ADR-749) — και ο πελατικός είναι ο **παρακάμψιμος**.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { HintedField } from '@/components/ui/hinted-field';
import { EscoOccupationPicker } from '@/components/shared/EscoOccupationPicker';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import {
  REGISTRY_AUTHORITY_PRESENTATION,
  isChapteredRegistry,
} from '@/constants/professional-registries';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Το namespace των **ονομάτων των αρχών** — δηλωμένο δίπλα στον καταναλωτή τους. */
const REGISTRY_NS = 'property-market';

/**
 * **Ό,τι κρατά η φόρμα για ΜΙΑ ειδικότητα.**
 *
 * ⚠️ Το `escoUri` είναι `null` όσο ο άνθρωπος γράφει **ελεύθερο κείμενο**: ο
 * επιλογέας το επιτρέπει *(είναι χρήσιμο στο CRM)*, η **βιτρίνα** όχι — γιατί
 * χωρίς URI η ειδικότητα δεν μπαίνει σε κανένα φίλτρο. Το λέμε **ρητά**, αντί
 * να πετάξουμε σιωπηλά ό,τι πληκτρολόγησε.
 */
export interface ShowcaseCredentialDraft {
  readonly profession: string;
  readonly escoUri: string | null;
  readonly iscoCode: string | null;
  readonly registrationNumber: string;
  readonly registrationChapter: string;
}

export const EMPTY_CREDENTIAL_DRAFT: ShowcaseCredentialDraft = {
  profession: '',
  escoUri: null,
  iscoCode: null,
  registrationNumber: '',
  registrationChapter: '',
};

export interface ShowcaseCredentialFieldProps {
  readonly index: number;
  readonly draft: ShowcaseCredentialDraft;
  readonly onChange: (draft: ShowcaseCredentialDraft) => void;
  /** `null` όταν είναι η **μόνη** ειδικότητα — βιτρίνα χωρίς καμία δεν υπάρχει. */
  readonly onRemove: (() => void) | null;
}

export function ShowcaseCredentialField({
  index,
  draft,
  onChange,
  onRemove,
}: ShowcaseCredentialFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS, REGISTRY_NS]);
  const verdict = resolveRegistryAuthority(draft.iscoCode);

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground" htmlFor={`showcase-occupation-${index}`}>
          {t(SHOWCASE_KEYS.occupationLabel)}
        </label>
        <EscoOccupationPicker
          value={draft.profession}
          escoUri={draft.escoUri ?? undefined}
          iscoCode={draft.iscoCode ?? undefined}
          placeholder={t(SHOWCASE_KEYS.occupationPlaceholder)}
          onChange={(picked) =>
            onChange({
              ...draft,
              profession: picked.profession ?? '',
              escoUri: picked.escoUri ?? null,
              iscoCode: picked.iscoCode ?? null,
            })
          }
        />
        <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_KEYS.occupationHint)}</p>
        {/* 🔑 **Η σιωπή θα ήταν χειρότερη**: ο άνθρωπος βλέπει το κείμενό του στο
            πεδίο και υποθέτει ότι καταχωρήθηκε. Το λέμε πριν πατήσει. */}
        {draft.profession.trim() !== '' && draft.escoUri === null && (
          <p className="m-0 text-xs text-destructive">{t(SHOWCASE_KEYS.occupationUnclassified)}</p>
        )}
      </div>

      <RegistryFields draft={draft} index={index} onChange={onChange} verdict={verdict} />

      {onRemove !== null && (
        <div>
          <Button type="button" size="sm" variant="outline" onClick={onRemove}>
            {t(SHOWCASE_KEYS.removeOccupation)}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

/**
 * **Τα πεδία του μητρώου — ή η εξήγηση της απουσίας τους.**
 *
 * 🔴 **Η ΑΠΟΥΣΙΑ ΕΞΗΓΕΙΤΑΙ ΠΑΝΤΑ, ΠΟΤΕ ΔΕΝ ΣΩΠΑΙΝΕΙ**, και τα δύο κείμενα είναι
 * **διαφορετικά επίτηδες**: *«δεν τηρείται μητρώο»* είναι **ΓΝΩΣΗ** μας· *«δεν
 * έχουμε εξετάσει»* είναι **ΑΓΝΟΙΑ** μας. Ισοπεδωμένα, το δεύτερο θα φορούσε τη
 * στολή του πρώτου — δηλαδή θα λέγαμε στον συμβολαιογράφο *«δεν υπάρχει μητρώο
 * για σένα»* ενώ απλώς **δεν κοιτάξαμε**.
 */
function RegistryFields({
  draft,
  index,
  onChange,
  verdict,
}: {
  readonly draft: ShowcaseCredentialDraft;
  readonly index: number;
  readonly onChange: (draft: ShowcaseCredentialDraft) => void;
  readonly verdict: ReturnType<typeof resolveRegistryAuthority>;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS, REGISTRY_NS]);

  // ⚠️ Πριν διαλέξει ειδικότητα δεν υπάρχει ερώτημα — και μια πρόωρη εξήγηση
  //    («δεν τηρείται μητρώο») θα ήταν **ψευδής**: δεν ξέρουμε ακόμη για ποιο.
  if (verdict.kind === 'absent' || verdict.kind === 'malformed') return null;

  if (verdict.kind === 'no-registry') {
    return <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.registryNone)}</p>;
  }
  if (verdict.kind === 'unexamined') {
    return (
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.registryUnexamined)}</p>
    );
  }

  // 🔴 Η **αρχή ονομάζεται**, δεν επιλέγεται: το `{{authority}}` έρχεται από τον
  //    πίνακα του λεξιλογίου, ώστε ο άνθρωπος να ξέρει **ποιανού** αριθμό δηλώνει.
  const authorityName = t(REGISTRY_AUTHORITY_PRESENTATION[verdict.authority].nameKey);

  return (
    <>
      <HintedField
        id={`showcase-registry-${index}`}
        label={t(SHOWCASE_KEYS.registryLabel, { authority: authorityName })}
        hint={t(SHOWCASE_KEYS.registryHint)}
        placeholder={t(SHOWCASE_KEYS.registryPlaceholder)}
        value={draft.registrationNumber}
        onChange={(registrationNumber) => onChange({ ...draft, registrationNumber })}
      />
      {isChapteredRegistry(verdict.authority) && (
        <HintedField
          id={`showcase-chapter-${index}`}
          label={t(SHOWCASE_KEYS.chapterLabel)}
          hint={t(SHOWCASE_KEYS.chapterHint)}
          placeholder={t(SHOWCASE_KEYS.chapterPlaceholder)}
          value={draft.registrationChapter}
          onChange={(registrationChapter) => onChange({ ...draft, registrationChapter })}
        />
      )}
    </>
  );
}
