'use client';

/**
 * @fileoverview **ΤΙ ΤΟΝ ΚΑΝΕΙ ΑΞΙΟΠΙΣΤΟ** — δύο γραμμές, ποτέ μία πρόταση.
 * @related ADR-841 Α9 · ADR-798 §7 · lib/professional/professional-credibility
 * @module components/mandate/CredibilityStatement
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΝΑ COMPONENT, ΔΥΟ ΟΘΟΝΕΣ — ΚΑΙ Η ΣΤΡΙΜΩΞΙΑ ΔΕΝ ΕΙΝΑΙ ΛΟΓΟΣ ΝΑ ΚΟΠΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο αποδίδεται στην **κάρτα** του `/pro` και στη **βιτρίνα**
 * `/pro/<ψευδώνυμο>`. Αν το σημείωμα παραλειφθεί από την κάρτα «για χώρο»,
 * **εκεί ακριβώς** το `declared` διαβάζεται ως `verified` — και η κάρτα είναι η
 * οθόνη που βλέπουν **οι περισσότεροι**. Η θεραπεία της στριμωξιάς είναι
 * **διάταξη**, όχι δεύτερο λεκτικό.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Δεν αποφασίζει.** Η σύνθεση των δύο ερωτημάτων ζει ολόκληρη στην καθαρή
 * {@link composeCredibility} — εδώ γίνεται μόνο **απόδοση**. Αν η απόφαση έμπαινε
 * σε JSX, τα 15 κελιά θα δοκιμάζονταν μόνο μέσω render και η μετάλλαξη *«δύο
 * κελιά λένε το ίδιο»* θα γινόταν **αόρατη**.
 *
 * ⚠️ **ΚΑΝΕΝΑ `text-primary`** — στο προεπιλεγμένο (σκοτεινό) θέμα λύνεται
 * **ταυτόσημα με το `--card`**, δηλαδή 1,00:1 = αόρατο *(CHECK 3.38)*.
 * ⚠️ **Κάθε κατάσταση φέρει εικονίδιο ΚΑΙ κείμενο** — ποτέ μόνο χρώμα
 * *(CHECK 3.41 · WCAG 1.4.1)*. Ίδιο πρότυπο με το `DeclaredOccupationBadge`.
 */

import React from 'react';
import { BadgeCheck, CircleHelp, CircleSlash, IdCard, Info, TriangleAlert } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import { composeCredibility } from '@/lib/professional/professional-credibility';
import type {
  CredibilityClaim,
  CredibilityNote,
} from '@/lib/professional/professional-credibility';
import type { ShowcaseCredential } from '@/types/agency-profile';

import { AGENCY_PUBLIC_NS, CREDIBILITY_KEYS, CREDIBILITY_NOTE_KEYS } from './agency-directory-labels';

/**
 * Εικονίδιο ανά σημείωμα. **Ολικός `Record`** ⇒ έβδομο σημείωμα δεν
 * μεταγλωττίζεται μέχρι να αποκτήσει σήμα.
 *
 * ⚠️ Το `authority-mismatch` και το `classification-unreadable` μοιράζονται
 * εικονίδιο **επίτηδες** *(και τα δύο λένε «κάτι δεν στέκει εδώ»)*, αλλά **ποτέ
 * κείμενο**: το πρώτο αφορά τον **άνθρωπο**, το δεύτερο **εμάς**.
 */
const NOTE_ICON: Record<CredibilityNote['kind'], React.ComponentType<{ className?: string }>> = {
  'registry-exists-undeclared': Info,
  'registry-absent-by-nature': CircleSlash,
  'registry-unexamined': CircleHelp,
  'authority-mismatch': TriangleAlert,
  'registry-absent-yet-declared': Info,
  'classification-unreadable': TriangleAlert,
};

export interface CredibilityStatementProps {
  readonly credential: ShowcaseCredential;
}

/**
 * **Τι ξέρουμε γι' αυτόν τον ισχυρισμό** — και τι **δεν** ξέρουμε.
 */
export function CredibilityStatement({
  credential,
}: CredibilityStatementProps): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);

  // 🔑 Η ΣΥΝΘΕΣΗ ΓΙΝΕΤΑΙ ΕΞΩ. Εδώ μόνο αποδίδεται.
  const { claim, note } = composeCredibility(
    resolveRegistryAuthority(credential.occupation.iscoCode),
    credential.attestation,
  );
  const NoteIcon = note === null ? null : NOTE_ICON[note.kind];

  return (
    <section className="flex flex-col gap-1">
      {claim !== null && <ClaimLines claim={claim} />}

      {note !== null && NoteIcon !== null && (
        <p className="m-0 flex items-start gap-1.5 text-xs text-muted-foreground">
          <NoteIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t(CREDIBILITY_NOTE_KEYS[note.kind], {
              // ⚠️ Και τα δύο περνιούνται ΠΑΝΤΑ: το i18n αγνοεί όσα δεν
              //    χρησιμοποιεί το κλειδί, ενώ ένα υπό συνθήκη αντικείμενο θα
              //    ήταν τέσσερις κλάδοι για δύο διαθέσιμες τιμές.
              authority: 'authority' in note ? t(REGISTRY_AUTHORITY_PRESENTATION[note.authority].nameKey) : '',
              expected: 'expected' in note ? t(REGISTRY_AUTHORITY_PRESENTATION[note.expected].nameKey) : '',
            })}
          </span>
        </p>
      )}
    </section>
  );
}

/**
 * Ο **ισχυρισμός** — δύο `<p>`, ποτέ ένα.
 *
 * 🔴 **Η ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΥΠΑΡΧΕΙ ΤΟ ΣΧΗΜΑ.** Χωρίς αυτήν, το
 * «ΔΣΘ 1234» διαβάζεται ως **επιβεβαίωση** — και ο επισκέπτης υποθέτει το
 * χειρότερο για εμάς: ότι το ελέγξαμε.
 */
function ClaimLines({ claim }: { readonly claim: CredibilityClaim }): React.JSX.Element {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const { registration } = claim;
  const authorityName = t(REGISTRY_AUTHORITY_PRESENTATION[registration.authority].nameKey);
  const verified = claim.state === 'verified';

  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-sm text-foreground">
        {/* ⚠️ Δύο ΔΙΑΦΟΡΕΤΙΚΑ εικονίδια — ποτέ το ίδιο με άλλο χρώμα. */}
        {verified ? (
          <BadgeCheck className="size-4 shrink-0 text-[hsl(var(--text-success))]" aria-hidden="true" />
        ) : (
          <IdCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span>
          {/*
            ⛔ ΠΟΤΕ ΣΚΕΤΟΣ ΑΡΙΘΜΟΣ: «1234» χωρίς τον εκδότη του δεν επαληθεύεται
            από κανέναν — θα ήταν «αριθμός που φοράει τη στολή απόδειξης» (Α9.1).
            Ο μεταγλωττιστής το επιβάλλει στον ΤΥΠΟ· εδώ φαίνεται στην οθόνη.
          */}
          {registration.authorityKind === 'chapter'
            ? t(CREDIBILITY_KEYS.claimChapter, {
                chapter: registration.chapter,
                authority: authorityName,
                number: registration.number,
              })
            : t(CREDIBILITY_KEYS.claimNational, {
                authority: authorityName,
                number: registration.number,
              })}
        </span>
      </p>
      <p
        className={
          verified
            ? 'm-0 pl-5 text-xs text-[hsl(var(--text-success))]'
            : 'm-0 pl-5 text-xs text-muted-foreground'
        }
      >
        {verified ? t(CREDIBILITY_KEYS.claimVerified) : t(CREDIBILITY_KEYS.claimDeclared)}
      </p>
    </>
  );
}
