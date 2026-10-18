'use client';

/**
 * @fileoverview **Οι άδειες της βιτρίνας** — «έχω άδεια» + αριθμός μητρώου (και εκδότης) (ADR-915 §21 · §34).
 * @related config/professional-licences.ts · lib/agency/showcase-licence.ts (ο γραφέας) · AgencyShowcaseContent.tsx
 * @module components/mandate/ShowcaseLicenceField
 *
 * 🔑 **Άδεια ≠ επάγγελμα**: ο ενεργειακός επιθεωρητής δηλώνει ΗΔΗ την ειδικότητά του (μηχανικός, πιο πάνω) και ΕΔΩ την
 *    επιπλέον άδεια. Μία γραμμή ανά άδεια του λεξιλογίου — νέα άδεια = νέα γραμμή, καμία αλλαγή εδώ.
 * 🔑 **Η αρχή ονομάζεται, δεν επιλέγεται** — ίδια πρόταση με το credential (`registryLabel`), ώστε ο άνθρωπος να ξέρει
 *    **ποιανού** αριθμό δηλώνει. Σε αρχή με παραρτήματα (Περιφερειακή Ενότητα) ζητείται **και** ο εκδότης, με την
 *    ετικέτα της **ίδιας** αρχής (`CHAPTER_PRESENTATION` — ίδιο σημείο με το πεδίο ειδικότητας).
 * 🔑 **Η άδεια που δίνει ήδη η ειδικότητα** (ηλεκτρολόγος + εγγραφή Περιφέρειας, §34 Λ3) φαίνεται ως **γραμμή**, όχι
 *    checkbox: ο άνθρωπος βλέπει ότι μετρά, και δεν τη δηλώνει δεύτερη φορά (ο γραφέας θα την αρνιόταν, Λ5).
 * 🔑 Η κατάσταση της φόρμας ζει **εδώ** (τύπος + μετατροπές)· η φόρμα κρατά μόνο την τιμή.
 */

import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { HintedField } from '@/components/ui/hinted-field';
import { SHOWCASE_KEYS, SHOWCASE_NS } from '@/components/mandate/agency-showcase-labels';
import {
  PROFESSIONAL_LICENCES,
  PROFESSIONAL_LICENCE_SPECS,
  type ProfessionalLicence,
} from '@/config/professional-licences';
import {
  CHAPTER_PRESENTATION,
  REGISTRY_AUTHORITY_PRESENTATION,
  isChapteredRegistry,
} from '@/constants/professional-registries';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ShowcaseLicenceWire } from '@/lib/agency/showcase-wire';
import type { ShowcaseLicence } from '@/types/agency-profile';

/** Μία δηλωμένη άδεια στη φόρμα — ο αριθμός και (σε αρχή με παραρτήματα) ο εκδότης, ίσως ακόμη κενά. */
export interface ShowcaseLicenceDraft {
  readonly number: string;
  readonly chapter: string;
}

/** Ανά άδεια: `null` = δεν την έχω · draft = την έχω, με αυτά τα στοιχεία. */
export type ShowcaseLicenceDrafts = Readonly<Record<ProfessionalLicence, ShowcaseLicenceDraft | null>>;

/** `Record` ολικός ⇒ νέα άδεια χωρίς γραμμή εδώ = σφάλμα μεταγλώττισης, όχι σιωπηλή απουσία από τη φόρμα. */
export const NO_LICENCE_DRAFTS: ShowcaseLicenceDrafts = { 'energy-inspector': null, 'electrical-installer': null };
const EMPTY_DRAFT: ShowcaseLicenceDraft = { number: '', chapter: '' };

/** Από τη δημοσιευμένη βιτρίνα στη φόρμα. */
export function licenceDraftsOf(licences: readonly ShowcaseLicence[]): ShowcaseLicenceDrafts {
  const drafts: Record<ProfessionalLicence, ShowcaseLicenceDraft | null> = { ...NO_LICENCE_DRAFTS };
  for (const { licence, attestation } of licences) {
    const { registration } = attestation;
    drafts[licence] = {
      number: registration.number,
      chapter: registration.authorityKind === 'chapter' ? registration.chapter : '',
    };
  }
  return drafts;
}

/**
 * Από τη φόρμα στο σύρμα — μόνο όσες δηλώνει· ο εκδότης **μόνο** όπου η αρχή τον έχει. Τα κενά φτάνουν στον γραφέα,
 * που αρνείται **ονομαστικά**. Άδεια που δίνει ήδη η ειδικότητα **δεν** στέλνεται: μια παλιά ρητή δήλωση της ίδιας άδειας
 * (πριν δηλωθεί η εγγραφή στην ειδικότητα) **ενοποιείται** με την αποθήκευση — αλλιώς ο γραφέας θα αρνιόταν για πάντα.
 */
export function licenceWireOf(
  drafts: ShowcaseLicenceDrafts,
  heldThrough: readonly ShowcaseLicence[],
): ShowcaseLicenceWire[] {
  return PROFESSIONAL_LICENCES.flatMap((licence) => {
    const draft = drafts[licence];
    if (draft === null || heldThrough.some((held) => held.licence === licence)) return [];
    const chaptered = isChapteredRegistry(PROFESSIONAL_LICENCE_SPECS[licence].authority);
    return [
      chaptered
        ? { licence, registrationNumber: draft.number, registrationChapter: draft.chapter }
        : { licence, registrationNumber: draft.number },
    ];
  });
}

export interface ShowcaseLicenceFieldProps {
  readonly value: ShowcaseLicenceDrafts;
  readonly onChange: (next: ShowcaseLicenceDrafts) => void;
  /** Οι άδειες που η βιτρίνα **ήδη** έχει μέσα από τις ειδικότητές της (`licencesHeldThroughCredentials`). */
  readonly heldThrough: readonly ShowcaseLicence[];
}

export function ShowcaseLicenceField({ value, onChange, heldThrough }: ShowcaseLicenceFieldProps): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="text-sm font-medium text-foreground">{t(SHOWCASE_KEYS.licencesLabel)}</legend>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_KEYS.licencesHint)}</p>
      {PROFESSIONAL_LICENCES.map((licence) => {
        const held = heldThrough.find((h) => h.licence === licence);
        return held !== undefined ? (
          <HeldThroughRow key={licence} held={held} />
        ) : (
          <LicenceRow
            key={licence}
            licence={licence}
            draft={value[licence]}
            onChange={(draft) => onChange({ ...value, [licence]: draft })}
          />
        );
      })}
    </fieldset>
  );
}

/** Η άδεια που δίνει ήδη η ειδικότητα — δηλωμένα, με τα στοιχεία της εγγραφής, και πού αλλάζει. */
function HeldThroughRow({ held }: { readonly held: ShowcaseLicence }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { registration } = held.attestation;
  const licence = t(PROFESSIONAL_LICENCE_SPECS[held.licence].nameKey);
  return (
    <p className="m-0 text-sm text-foreground">
      {registration.authorityKind === 'chapter'
        ? t(SHOWCASE_KEYS.licenceHeldThroughChapter, { licence, chapter: registration.chapter, number: registration.number })
        : t(SHOWCASE_KEYS.licenceHeldThroughNational, { licence, number: registration.number })}
    </p>
  );
}

function LicenceRow({
  licence,
  draft,
  onChange,
}: {
  readonly licence: ProfessionalLicence;
  readonly draft: ShowcaseLicenceDraft | null;
  readonly onChange: (draft: ShowcaseLicenceDraft | null) => void;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  // ⚠️ `spec.nameKey`, ΟΧΙ αποδόμηση: ο τεμαχιστής του CHECK 3.34 λύνει `t(TABLE[x].key)`, όχι `t(nameKey)`.
  const spec = PROFESSIONAL_LICENCE_SPECS[licence];
  const { authority } = spec;
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={draft !== null} onCheckedChange={(checked) => onChange(checked === true ? EMPTY_DRAFT : null)} />
        {t(SHOWCASE_KEYS.licenceHold, { licence: t(spec.nameKey) })}
      </label>
      {draft !== null && (
        <HintedField
          id={`showcase-licence-${licence}`}
          label={t(SHOWCASE_KEYS.registryLabel, { authority: t(REGISTRY_AUTHORITY_PRESENTATION[authority].nameKey) })}
          hint={t(SHOWCASE_KEYS.registryHint)}
          placeholder={t(SHOWCASE_KEYS.registryPlaceholder)}
          value={draft.number}
          onChange={(number) => onChange({ ...draft, number })}
        />
      )}
      {draft !== null && isChapteredRegistry(authority) && (
        <HintedField
          id={`showcase-licence-${licence}-chapter`}
          label={t(CHAPTER_PRESENTATION[authority].labelKey)}
          hint={t(CHAPTER_PRESENTATION[authority].hintKey)}
          placeholder={t(CHAPTER_PRESENTATION[authority].placeholderKey)}
          value={draft.chapter}
          onChange={(chapter) => onChange({ ...draft, chapter })}
        />
      )}
    </>
  );
}
