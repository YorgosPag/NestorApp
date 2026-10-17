'use client';

/**
 * @fileoverview **«Επόμενο βήμα»** — οι ενέργειες μιας γραμμής που έληξε, λήγει ή λείπει (ADR-915 §24).
 * @related lib/document-validity/document-next-step.ts (ο πυρήνας) · components/mandate/agency-directory-route.ts
 *   (`documentIssuerSearchHref`) · config/document-validity/document-issuers.ts (`AUTHORITY_SERVICE_SPECS`)
 * @module components/document-registry/RegistryNextStep
 *
 * 🔑 **Η ενέργεια ζει εκεί που φαίνεται το πρόβλημα** (Procore · myCOI): μέσα στη γραμμή, όχι σε άλλη σελίδα.
 * 🔑 **Οι ενέργειες ΠΑΡΑΓΟΝΤΑΙ** (`documentNextSteps`) — εδώ μόνο η παρουσίαση· ο ίδιος πυρήνας αποφασίζει στον διακομιστή
 *    για ποια ακίνητα υπολογίζεται περιοχή, άρα η οθόνη και η απόκριση δεν αποκλίνουν.
 * 🏆 **Πέρα από το Zillow/Houzz «find a pro»**: ο κατάλογος ανοίγει ήδη φιλτραρισμένος στο **προσόν** που μπορεί να
 *    υπογράψει το έγγραφο (όχι στο επάγγελμα) **και** στον δήμο του ακινήτου — και όταν ο δήμος δεν αποδεικνύεται, το
 *    λέει αντί να μαντέψει.
 * 🔑 ADR-915 §27 — **πρώτα** «Ανάθεση σε επαγγελματία» (γνωστός · πρόταση · απόφαση ιδιοκτήτη · μπάλα), **μετά** «Βρες».
 * ⚠️ Εξωτερική πύλη ⇒ `target="_blank"` + `rel="noopener noreferrer"` + δήλωση για τους αναγνώστες οθόνης (ίδιο ιδίωμα
 *    με το `LicenceStatement`). Εσωτερικός σύνδεσμος ⇒ **μόνο** από το σύνορο πλοήγησης (CHECK 3.61).
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import { AUTHORITY_SERVICE_SPECS, type AuthorityService } from '@/config/document-validity/document-issuers';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { documentNextSteps, type DocumentNextStep } from '@/lib/document-validity/document-next-step';
import type { RegistryRowState } from '@/lib/document-validity/document-registry';
import { canProposeIssuance } from '@/lib/document-validity/issuance-assignment';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { RegistryIssuanceStep } from '@/components/document-registry/RegistryIssuanceStep';
import { Link } from '@/lib/workspace/navigation';
import {
  ISSUER_AUTHORITY_LABEL_KEYS,
  NEXT_STEP_KEYS,
  REGISTRY_NS,
  SELF_SERVICE_PATH_KEYS,
} from '@/components/document-registry/document-registry-labels';

function FindProfessionalStep({ kind, areaId }: { readonly kind: DocumentKind; readonly areaId: string | null }) {
  const { t } = useTranslation([REGISTRY_NS]);
  return (
    <li className="flex flex-col gap-1">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={documentIssuerSearchHref(kind, areaId)}>{t(NEXT_STEP_KEYS.findProfessional)}</Link>
      </Button>
      {/* ⚠️ Τριαδικός ΜΕΣΑ στο `t(…)`: ο γεννήτορας του route slice λύνει στατικά μόνο αυτή τη μορφή. */}
      <p className="m-0 text-xs text-muted-foreground">
        {t(areaId !== null ? NEXT_STEP_KEYS.findProfessionalNear : NEXT_STEP_KEYS.findProfessionalAnywhere)}
      </p>
    </li>
  );
}

function SelfServiceStep({ service }: { readonly service: AuthorityService }) {
  const { t } = useTranslation([REGISTRY_NS]);
  // `useId`: το ίδιο είδος εμφανίζεται σε ΠΟΛΛΕΣ γραμμές — σταθερό id θα συγκρουόταν.
  const hintId = React.useId();
  const { authority, entryUrl } = AUTHORITY_SERVICE_SPECS[service];
  return (
    <li className="flex flex-col gap-1">
      <Button asChild variant="outline" size="sm" className="w-fit">
        <a href={entryUrl} target="_blank" rel="noopener noreferrer" aria-describedby={hintId}>
          {t(NEXT_STEP_KEYS.selfService, { authority: t(ISSUER_AUTHORITY_LABEL_KEYS[authority]) })}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </Button>
      <span id={hintId} className="sr-only">{t(NEXT_STEP_KEYS.opensInNewTab)}</span>
      <p className="m-0 text-xs text-foreground">{t(SELF_SERVICE_PATH_KEYS[service])}</p>
      <p className="m-0 text-xs text-muted-foreground">{t(NEXT_STEP_KEYS.selfServiceHint)}</p>
    </li>
  );
}

type Issuance = RegistryIssuanceView | 'unavailable' | null;
type People = Pick<DocumentRegistryResponse, 'people'>;

interface StepItemProps {
  readonly step: DocumentNextStep;
  readonly areaId: string | null;
  readonly issuance: Issuance;
  readonly registry: People;
}

function StepItem({ step, areaId, issuance, registry }: StepItemProps) {
  switch (step.kind) {
    // Γραμμή προσώπου ή άλλη επιφάνεια ⇒ καμία ανάθεση εδώ (`null`): μένει μόνο το «Βρες».
    case 'assign-professional': return issuance === null ? null : <RegistryIssuanceStep view={issuance} registry={registry} />;
    case 'find-professional': return <FindProfessionalStep kind={step.documentKind} areaId={areaId} />;
    case 'self-service': return <SelfServiceStep service={step.service} />;
  }
}

/**
 * ADR-915 §27 — **μία** ενεργή ανάθεση ανά (ακίνητο, είδος): όταν έχει δεσμευτεί επαγγελματίας (εγκρίθηκε · ενημερώθηκε
 * · αποδέχτηκε), το «Βρες» **φεύγει** — δεύτερος επαγγελματίας θα σήμαινε δεύτερο ΠΕΑ.
 */
function visibleSteps(steps: readonly DocumentNextStep[], issuance: Issuance): readonly DocumentNextStep[] {
  const committed = issuance !== null && issuance !== 'unavailable' && !canProposeIssuance(issuance.state);
  return committed ? steps.filter((step) => step.kind !== 'find-professional') : steps;
}

export interface RegistryNextStepProps {
  readonly kind: DocumentKind;
  readonly state: RegistryRowState;
  /** Ο δήμος του ακινήτου (`RegistryPropertyLabel.areaId`) — `null` = δεν αποδεικνύεται. */
  readonly areaId: string | null;
  /** §27 — η ανάθεση της γραμμής (`registryIssuanceOf`)· `null` = η γραμμή δεν ανατίθεται (πρόσωπο · άλλη επιφάνεια). */
  readonly issuance?: Issuance;
  /** §27 — τα ονόματα επαφών της απόκρισης (επαγγελματίες · υπεύθυνος). */
  readonly registry?: People;
}

const NO_PEOPLE: People = { people: {} };

export function RegistryNextStep({ kind, state, areaId, issuance = null, registry = NO_PEOPLE }: RegistryNextStepProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const headingId = React.useId();
  const steps = visibleSteps(documentNextSteps(kind, state), issuance);
  if (steps.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h4 id={headingId} className="m-0 text-sm font-semibold text-foreground">{t(NEXT_STEP_KEYS.heading)}</h4>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step) => (
          <StepItem key={step.kind} step={step} areaId={areaId} issuance={issuance} registry={registry} />
        ))}
      </ul>
    </section>
  );
}
