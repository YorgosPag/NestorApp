'use client';

/**
 * @fileoverview **ΤΟ ΚΕΙΜΕΝΟ ΤΗΣ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ, ΜΕ ΕΠΙΒΕΒΑΙΩΣΗ ΑΝΑ ΔΗΛΩΣΗ** (ADR-864 Φ3 · Ε-12 · Ε-14 · §18.4 Δ3).
 * @related lib/mandate/private-marketing-consent-text.ts · components/legal/LegalDocumentBody.tsx
 * @module components/mandate/PrivateMarketingConsentForm
 *
 * 🔑 **Μονογραφή ανά δήλωση** (Bright MLS Office Exclusive Form): κάθε δήλωση έχει δικό της πλαίσιο,
 * και η υποβολή ενεργοποιείται μόνο όταν επιβεβαιωθούν **όλες** — **για κάθε γραφείο**. Ο διακομιστής
 * το ξανακρίνει (Α8β)· η φόρμα **δείχνει**, δεν αποφασίζει.
 *
 * 🔑 **Πολλά γραφεία, μία υποβολή** (Δ3 · Α27): κάθε γραφείο έχει **το δικό του** κείμενο (η δήλωση σχέσης
 * ονομάζει **αυτό** το γραφείο και **αυτή** τη λήξη) και τη **δική του** μονογραφή — αλλά φεύγουν **μαζί**.
 *
 * ⚠️ Το κείμενο αποδίδεται από την **παγωμένη έκδοση** με τις τιμές που **έλυσε ο διακομιστής**, και
 * αυτές ακριβώς ταξιδεύουν πίσω (CAS, Α8α · Α25): ό,τι είδε ο άνθρωπος είναι ό,τι καταγράφεται.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useLegalTextFill } from '@/components/legal/useLegalTextFill';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { clauseIdsOf } from '@/lib/legal/legal-clauses';
import type { FrozenLegalSection, FrozenLegalText } from '@/lib/legal/frozen-legal-document';
import type { LegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import type { ConsentSubmission } from '@/lib/mandate/private-marketing-consent-text';
import type { ConsentPlaceholderValues } from '@/types/private-marketing-consent';

const NS = 'property-market';
const K = `${NS}:mandate.privateMarketing`;

/** Ένα γραφείο της υποβολής. `heading` μόνο όταν είναι πολλά — ένα κείμενο δεν χρειάζεται επικεφαλίδα. */
interface ConsentParty {
  readonly key: string;
  readonly values: ConsentPlaceholderValues;
  readonly heading?: string;
}

export interface PartySubmission {
  readonly key: string;
  readonly submission: ConsentSubmission;
}

interface PrivateMarketingConsentFormProps {
  readonly version: LegalDocumentVersion;
  readonly parties: readonly ConsentParty[];
  readonly busy: boolean;
  readonly onSubmit: (submissions: readonly PartySubmission[]) => void;
  /** Πρόσθετη προϋπόθεση υποβολής (π.χ. ανεβασμένο έντυπο — Α23). Προεπιλογή: καμία. */
  readonly ready?: boolean;
  /** Ό,τι μπαίνει πριν το κουμπί (π.χ. πεδίο αρχείου). */
  readonly children?: React.ReactNode;
  /** Τι υποβάλλεται — ο ιδιοκτήτης **συναινεί**, το γραφείο **υποβάλλει έντυπο**. Κλειστό σύνολο, ρητά `t()` (ADR-744). */
  readonly purpose?: 'consent' | 'attestation';
}

type Acknowledgements = ReadonlyMap<string, ReadonlySet<string>>;

/** ⚠️ Το περίγραμμα του εγγράφου (CHECK 3.85) επιτρέπει εδώ **μόνο** παραγράφους και δηλώσεις. */
function ConsentSection({
  section,
  acknowledged,
  onToggle,
  fill,
}: {
  readonly section: FrozenLegalSection;
  readonly acknowledged: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly fill: (text: string) => string;
}): React.ReactElement {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-card-foreground">{section.heading}</legend>
      {section.blocks.map((block, index) =>
        block.kind === 'clause' ? (
          <label key={block.id} className="flex items-start gap-2 text-sm text-card-foreground">
            <input type="checkbox" checked={acknowledged.has(block.id)} onChange={() => onToggle(block.id)} />
            <span>{fill(block.text)}</span>
          </label>
        ) : block.kind === 'paragraph' ? (
          <p key={`${section.id}-${index}`} className="text-sm text-muted-foreground">{fill(block.text)}</p>
        ) : null,
      )}
    </fieldset>
  );
}

/** Το κείμενο **ενός** γραφείου — ο συμπληρωτής θέσεων είναι hook, άρα ένα component ανά γραφείο. */
function PartyText({
  party,
  text,
  acknowledged,
  onToggle,
}: {
  readonly party: ConsentParty;
  readonly text: FrozenLegalText;
  readonly acknowledged: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}): React.ReactElement {
  const fill = useLegalTextFill(party.values);
  return (
    <section className="flex flex-col gap-4">
      {party.heading !== undefined && <h3 className="text-sm font-semibold text-card-foreground">{party.heading}</h3>}
      {text.sections.map((section) => (
        <ConsentSection key={section.id} section={section} acknowledged={acknowledged} onToggle={onToggle} fill={fill} />
      ))}
    </section>
  );
}

function toggled(current: Acknowledgements, key: string, id: string): Acknowledgements {
  const next = new Map(current);
  const clauses = new Set(current.get(key) ?? []);
  if (clauses.has(id)) clauses.delete(id);
  else clauses.add(id);
  next.set(key, clauses);
  return next;
}

export function PrivateMarketingConsentForm({
  version,
  parties,
  busy,
  onSubmit,
  ready = true,
  children,
  purpose = 'consent',
}: PrivateMarketingConsentFormProps): React.ReactElement {
  const { t, i18n } = useTranslation([NS, 'legal']);
  const locale = resolveHumanLanguage(i18n.language);
  const text = version.frozen.locales[locale];
  const required = clauseIdsOf(version.frozen);
  const [acknowledged, setAcknowledged] = React.useState<Acknowledgements>(new Map());
  const complete = parties.length > 0 && parties.every((party) => required.every((id) => acknowledged.get(party.key)?.has(id) === true));

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!complete || !ready) return;
    onSubmit(
      parties.map((party) => ({
        key: party.key,
        submission: { version: version.frozen.version, acknowledged: [...(acknowledged.get(party.key) ?? [])], locale, values: party.values },
      })),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {parties.map((party) => (
        <PartyText
          key={party.key}
          party={party}
          text={text}
          acknowledged={acknowledged.get(party.key) ?? new Set()}
          onToggle={(id) => setAcknowledged((current) => toggled(current, party.key, id))}
        />
      ))}
      <p className="text-xs text-muted-foreground">{t(`${K}.versionNote`, { version: version.frozen.version })}</p>
      {children}
      <Button type="submit" disabled={!complete || !ready || busy} className="self-start">
        {busy ? t(`${K}.sending`) : purpose === 'attestation' ? t(`${K}.agency.attestSubmit`) : t(`${K}.submit`)}
      </Button>
    </form>
  );
}
