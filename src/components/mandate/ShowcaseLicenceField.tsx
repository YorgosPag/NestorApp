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
import { CONTACT_LICENCE_KEYS } from '@/components/contacts/contact-licence-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LicenceDraft, LicenceDrafts } from '@/lib/professional/licence-drafts';
import type { ShowcaseLicence } from '@/types/agency-profile';

const EMPTY_DRAFT: LicenceDraft = { number: '', chapter: '' };

/**
 * **Ποιος μιλά** (ADR-915 §40.5): `self` = ο ίδιος για τη βιτρίνα του («Έχω άδεια») · `office` = το γραφείο για την
 * επαφή του («Έχει άδεια»). Ίδιο πεδίο, ίδιοι κανόνες — μόνο η φωνή αλλάζει. Πίνακας μελών (ADR-744 slice).
 */
export type LicenceFieldVoice = 'self' | 'office';

interface VoiceKeys {
  readonly legend: string;
  readonly hint: string;
  readonly hold: string;
  readonly registryHint: string;
}

/** ⚠️ Δηλωμένος τύπος, ΟΧΙ `as const satisfies`: ο εξαγωγέας του slice (`key-tables.js`) δεν διαβάζει το δεύτερο (ADR-744 §27.4). */
const VOICE_KEYS: Readonly<Record<LicenceFieldVoice, VoiceKeys>> = {
  self: {
    legend: SHOWCASE_KEYS.licencesLabel,
    hint: SHOWCASE_KEYS.licencesHint,
    hold: SHOWCASE_KEYS.licenceHold,
    registryHint: SHOWCASE_KEYS.registryHint,
  },
  office: {
    legend: CONTACT_LICENCE_KEYS.legend,
    hint: CONTACT_LICENCE_KEYS.hint,
    hold: CONTACT_LICENCE_KEYS.hold,
    registryHint: CONTACT_LICENCE_KEYS.registryHint,
  },
};

const FIELD_NAMESPACES = [SHOWCASE_NS, 'contacts-form'];

export interface ShowcaseLicenceFieldProps {
  readonly value: LicenceDrafts;
  readonly onChange: (next: LicenceDrafts) => void;
  /** Οι άδειες που η βιτρίνα **ήδη** έχει μέσα από τις ειδικότητές της (`licencesHeldThroughCredentials`). */
  readonly heldThrough: readonly ShowcaseLicence[];
  /** Προεπιλογή `self` (βιτρίνα). */
  readonly voice?: LicenceFieldVoice;
  readonly disabled?: boolean;
}

export function ShowcaseLicenceField({
  value,
  onChange,
  heldThrough,
  voice = 'self',
  disabled = false,
}: ShowcaseLicenceFieldProps): React.ReactElement {
  const { t } = useTranslation(FIELD_NAMESPACES);
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0" disabled={disabled}>
      {/* Στη φόρμα επαφής η ετικέτα πεδίου υπάρχει ήδη (`FormField`) — η λεζάντα μένει μόνο για τους αναγνώστες οθόνης. */}
      <legend className={voice === 'office' ? 'sr-only' : 'text-sm font-medium text-foreground'}>{t(VOICE_KEYS[voice].legend)}</legend>
      <p className="m-0 text-sm text-muted-foreground">{t(VOICE_KEYS[voice].hint)}</p>
      {PROFESSIONAL_LICENCES.map((licence) => {
        const held = heldThrough.find((h) => h.licence === licence);
        return held !== undefined ? (
          <HeldThroughRow key={licence} held={held} />
        ) : (
          <LicenceRow
            key={licence}
            licence={licence}
            voice={voice}
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
  voice,
  draft,
  onChange,
}: {
  readonly licence: ProfessionalLicence;
  readonly voice: LicenceFieldVoice;
  readonly draft: LicenceDraft | null;
  readonly onChange: (draft: LicenceDraft | null) => void;
}): React.ReactElement {
  const { t } = useTranslation(FIELD_NAMESPACES);
  // ⚠️ `spec.nameKey`, ΟΧΙ αποδόμηση: ο τεμαχιστής του CHECK 3.34 λύνει `t(TABLE[x].key)`, όχι `t(nameKey)`.
  const spec = PROFESSIONAL_LICENCE_SPECS[licence];
  const { authority } = spec;
  return (
    <>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={draft !== null} onCheckedChange={(checked) => onChange(checked === true ? EMPTY_DRAFT : null)} />
        {t(VOICE_KEYS[voice].hold, { licence: t(spec.nameKey) })}
      </label>
      {draft !== null && (
        <HintedField
          id={`showcase-licence-${licence}`}
          label={t(SHOWCASE_KEYS.registryLabel, { authority: t(REGISTRY_AUTHORITY_PRESENTATION[authority].nameKey) })}
          hint={t(VOICE_KEYS[voice].registryHint)}
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
