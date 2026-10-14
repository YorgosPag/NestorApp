'use client';

/**
 * **Η προεπισκόπηση της εισαγωγής ΠΕΑ** (ADR-777 §8.96) — ο άνθρωπος βλέπει τι διαβάστηκε, κλείνει ό,τι δεν λέει το
 * έγγραφο, και **μόνο τότε** εφαρμόζει.
 *
 * @related `./EnergyCertificateImportChanges.tsx` (ο πίνακας) · `./EnergyCertificateImportNotes.tsx` (σημειώσεις) ·
 *   `lib/energy-certificate/pea-proposal.ts#peaPatchOf` (η διόρθωση που φεύγει)
 *
 * 🔑 **Δύο απαντήσεις που το έγγραφο δεν δίνει**: η **κλάση**, όταν ο λόγος Τ πέφτει πάνω σε όριο (ή δεν διαβάστηκε) —
 * επιλογή χωρίς προεπιλογή, κοιτώντας το βέλος του PDF· και η **εμβέλεια** (μονάδα ή κτήριο) — προεπιλεγμένη μόνο όταν
 * το εμβαδόν δίνει ισχυρή ένδειξη. Χωρίς τις δύο, το «Εφαρμογή» μένει ανενεργό.
 * 🔑 **Καμία εγγραφή εδώ**: το «Εφαρμογή» δίνει τη διόρθωση στον καλούντα, που την περνά από τον ΙΔΙΟ δρόμο με το χέρι.
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ENERGY_CLASSES, isEnergyClass, type EnergyClass } from '@/constants/energy-classes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  ENERGY_CERTIFICATE_SCOPES,
  isEnergyCertificateScope,
  type EnergyCertificate,
  type EnergyCertificatePatch,
  type EnergyCertificateScope,
} from '@/lib/energy-certificate/energy-certificate';
import { ENERGY_CERTIFICATE_SCOPE_KEY, ENERGY_CLASS_LABEL_KEY } from '@/lib/energy-certificate/energy-certificate-keys';
import { ENERGY_CLASS_RATIO_SOURCE } from '@/lib/energy-certificate/energy-class-ratio';
import type { EnergyCertificateImportCommit } from '@/lib/energy-certificate/pea-import-outcome';
import { peaPatchOf, settledClassOf, type PeaProposal } from '@/lib/energy-certificate/pea-proposal';
import { formatNumber } from '@/lib/intl-formatting';

import { EnergyCertificateImportChanges } from './EnergyCertificateImportChanges';
import { EnergyCertificateImportVerification, EnergyCertificateImportWarnings } from './EnergyCertificateImportNotes';

const NS = 'properties-enums';

const decimal = (value: number | null, digits = 1): string =>
  value === null ? '' : formatNumber(value, { maximumFractionDigits: digits });

/** Οι επιλογές κλάσης όταν ο λόγος δεν αρκεί: οι υποψήφιες, ή ολόκληρη η κλίμακα αν δεν διαβάστηκε. */
function classOptionsOf(proposal: PeaProposal): readonly EnergyClass[] {
  return proposal.classResult.kind === 'ambiguous' ? proposal.classResult.candidates : ENERGY_CLASSES;
}

function ClassChoice({
  proposal,
  value,
  onChange,
}: {
  readonly proposal: PeaProposal;
  readonly value: EnergyClass | null;
  readonly onChange: (next: EnergyClass) => void;
}) {
  const { t } = useTranslation([NS]);
  const { classResult, reading } = proposal;
  const ratioValues = {
    ep: decimal(reading.primaryEnergy),
    rr: decimal(reading.referenceEnergy),
    source: ENERGY_CLASS_RATIO_SOURCE,
  };

  if (classResult.kind === 'exact') {
    return (
      <p className="m-0 text-xs text-foreground">
        {t(`${NS}:energyCertificate.import.review.classExact`, {
          ...ratioValues,
          class: t(ENERGY_CLASS_LABEL_KEY[classResult.class]),
          ratio: decimal(classResult.ratio, 3),
        })}
      </p>
    );
  }
  const legend =
    classResult.kind === 'ambiguous'
      ? t(`${NS}:energyCertificate.import.review.classAmbiguous`, ratioValues)
      : t(`${NS}:energyCertificate.import.review.classUnreadable`);
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="p-0 text-xs text-foreground">{legend}</legend>
      <RadioGroup value={value ?? ''} onValueChange={(next) => isEnergyClass(next) && onChange(next)} className="flex flex-wrap gap-3">
        {classOptionsOf(proposal).map((energyClass) => (
          <span key={energyClass} className="flex items-center gap-1">
            <RadioGroupItem id={`pea-class-${energyClass}`} value={energyClass} />
            <Label htmlFor={`pea-class-${energyClass}`} className="text-xs">{t(ENERGY_CLASS_LABEL_KEY[energyClass])}</Label>
          </span>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function ScopeChoice({
  proposal,
  value,
  onChange,
}: {
  readonly proposal: PeaProposal;
  readonly value: EnergyCertificateScope | null;
  readonly onChange: (next: EnergyCertificateScope) => void;
}) {
  const { t } = useTranslation([NS]);
  const { unitTitle, buildingUse, usefulArea } = proposal.reading;

  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="p-0 text-xs font-semibold text-foreground">{t(`${NS}:energyCertificate.import.review.scopeLegend`)}</legend>
      <p className="m-0 text-xs text-muted-foreground">
        {t(`${NS}:energyCertificate.import.review.scopeDocument`, {
          title: unitTitle ?? '—',
          use: buildingUse ?? '—',
          area: usefulArea === null ? '—' : decimal(usefulArea),
        })}
      </p>
      <RadioGroup value={value ?? ''} onValueChange={(next) => isEnergyCertificateScope(next) && onChange(next)} className="flex flex-col gap-1">
        {ENERGY_CERTIFICATE_SCOPES.map((scope) => (
          <span key={scope} className="flex items-center gap-2">
            <RadioGroupItem id={`pea-scope-${scope}`} value={scope} />
            <Label htmlFor={`pea-scope-${scope}`} className="text-xs">{t(ENERGY_CERTIFICATE_SCOPE_KEY[scope])}</Label>
          </span>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/** Τι γίνεται μετά την εφαρμογή + τα δύο κουμπιά. Το «Εφαρμογή» ζει μόνο όταν υπάρχει έγκυρη διόρθωση. */
function ReviewFooter({
  commit,
  patch,
  onCancel,
  onApply,
}: {
  readonly commit: EnergyCertificateImportCommit;
  readonly patch: EnergyCertificatePatch | null;
  readonly onCancel: () => void;
  readonly onApply: (patch: EnergyCertificatePatch) => void;
}) {
  const { t } = useTranslation([NS]);
  return (
    <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
      <p className="m-0 text-xs text-muted-foreground sm:mr-auto">
        {commit === 'form-save'
          ? t(`${NS}:energyCertificate.import.review.commitFormSave`)
          : t(`${NS}:energyCertificate.import.review.commitImmediate`)}
      </p>
      <Button type="button" variant="outline" onClick={onCancel}>{t(`${NS}:energyCertificate.import.review.cancel`)}</Button>
      <Button type="button" disabled={patch === null} onClick={() => patch !== null && onApply(patch)}>
        {t(`${NS}:energyCertificate.import.review.apply`)}
      </Button>
    </DialogFooter>
  );
}

export interface EnergyCertificateImportReviewProps {
  readonly proposal: PeaProposal;
  readonly current: EnergyCertificate;
  /** Τι γίνεται μετά την εφαρμογή — η φόρμα του γραφείου θέλει «Αποθήκευση», ο ιδιώτης αποθηκεύει αμέσως. */
  readonly commit: EnergyCertificateImportCommit;
  readonly onCancel: () => void;
  readonly onApply: (patch: EnergyCertificatePatch) => void;
}

export function EnergyCertificateImportReview(props: EnergyCertificateImportReviewProps) {
  const { proposal, current, commit, onCancel, onApply } = props;
  const { t } = useTranslation([NS]);
  const [chosenClass, setChosenClass] = useState<EnergyClass | null>(() => settledClassOf(proposal));
  const [chosenScope, setChosenScope] = useState<EnergyCertificateScope | null>(proposal.suggestedScope);
  const patch =
    chosenClass === null || chosenScope === null ? null : peaPatchOf(proposal, { class: chosenClass, scope: chosenScope });
  const { protocol } = proposal.reading;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {protocol === null
              ? t(`${NS}:energyCertificate.import.review.titleNoProtocol`)
              : t(`${NS}:energyCertificate.import.review.title`, { protocol })}
          </DialogTitle>
          <DialogDescription>{t(`${NS}:energyCertificate.import.review.description`)}</DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-4">
          <EnergyCertificateImportWarnings proposal={proposal} current={current} />
          <ClassChoice proposal={proposal} value={chosenClass} onChange={setChosenClass} />
          <ScopeChoice proposal={proposal} value={chosenScope} onChange={setChosenScope} />
          <EnergyCertificateImportChanges current={current} next={{ ...proposal.figures, class: chosenClass, scope: chosenScope }} />
          <EnergyCertificateImportVerification proposal={proposal} />
        </section>
        <ReviewFooter commit={commit} patch={patch} onCancel={onCancel} onApply={onApply} />
      </DialogContent>
    </Dialog>
  );
}
