'use client';

/**
 * @fileoverview **ΟΙ ΕΝΟΤΗΤΕΣ ΤΩΝ «ΣΤΟΙΧΕΙΩΝ ΓΕΜΗ»** — κλείσιμο, κρίση, υιοθέτηση (ADR-841 §7 Α23.9 Φέτα Β).
 * @related components/mandate/ShowcaseRegistryContent.tsx · hooks/company/useCompanyRegistryIdentity.ts
 * @module components/mandate/ShowcaseRegistrySections
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ — ΜΟΝΟ ΑΠΟΔΟΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Ο **ένας** κριτής |
 * |---|---|
 * | υιοθετήσιμη; ποια επωνυμία στην προεπισκόπηση; | `adoptableRegistryCheckOf` — **ο ίδιος** με τον φρουρό του διακομιστή |
 * | διορθώνεται στον αριθμό; | `needsRegistrationFix` |
 * | κλειστή; | `registryClosureOf` (στον καλούντα) |
 *
 * ⚠️ **Η προεπισκόπηση ΕΙΝΑΙ το `expectedLegalName`** (Α23.2): πατώντας, ταξιδεύει **ό,τι είδε** ο άνθρωπος — αν το
 * ΓΕΜΗ άλλαξε στο μεταξύ, ο διακομιστής απαντά 409 με τη νέα αναφορά και η οθόνη δείχνει **αμέσως** τη νέα επωνυμία
 * (AIP-154 `ABORTED`). Ποτέ υιοθέτηση επωνυμίας που δεν είδε.
 *
 * ⚖️ **GDPR**: καμία νέα επεξεργασία — η οθόνη αποδίδει ό,τι ήδη κρατάμε (Α23.5). Η υιοθέτηση: 6(1)(β) (ρητή πράξη
 * κατόχου) · 5(1)(δ) ακρίβεια. Το κλείσιμο: 5(1)(δ) — η ένδειξη δεν κρύβεται από τον κάτοχο που μπορεί να τη διορθώσει.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CompanyRegistryIdentity } from '@/hooks/company/useCompanyRegistryIdentity';
import { needsRegistrationFix } from '@/lib/agency/registry-standing';
import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import { adoptableRegistryCheckOf, holdsRegistryCopy } from '@/lib/company/registry-identity-judgment';
import { formatLongDate } from '@/lib/intl-formatting';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { Link } from '@/lib/workspace/navigation';
import type { RegistryIdentityReport } from '@/types/company-registry';
import type { RegistryClosure } from '@/types/showcase-legal-identity';

import { SHOWCASE_NS } from './agency-showcase-labels';
import { ShowcaseWithdrawButton } from './ShowcaseWithdrawButton';
import {
  SHOWCASE_REGISTRY_ADOPTION_KEYS,
  SHOWCASE_REGISTRY_ERASURE_KEYS,
  SHOWCASE_REGISTRY_GAP_KEYS,
  SHOWCASE_REGISTRY_KEYS,
  SHOWCASE_REGISTRY_UNAVAILABLE_KEYS,
} from './agency-showcase-registry-labels';

/** Η διόρθωση ζει στο **μοναδικό** σημείο όπου γράφεται ο αριθμός — ποτέ δεύτερο πεδίο εδώ. */
function FixNumberLink(): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <Link
      href={APP_ROUTES.accountingSetup}
      className="text-sm font-medium text-foreground underline underline-offset-4"
      data-testid="showcase-registry-fix-number"
    >
      {t(SHOWCASE_REGISTRY_KEYS.fixNumber)}
    </Link>
  );
}

/**
 * 🔴 **ΚΛΕΙΣΤΗ ΣΤΟ ΓΕΜΗ — ΜΟΝΙΜΗ ΕΝΔΕΙΞΗ, ΜΕ ΤΙΣ ΔΥΟ ΘΕΡΑΠΕΙΕΣ** (Α23.1): «λάθος αριθμός» ⇒ διόρθωση στο προφίλ ·
 * «όντως έκλεισε» ⇒ απόσυρση (η **ίδια** πράξη με τη σελίδα της βιτρίνας — `useAgencyShowcase.withdraw`).
 */
export function RegistryClosureNotice({
  closure,
  busy,
  onWithdraw,
}: {
  readonly closure: RegistryClosure;
  readonly busy: 'publishing' | 'withdrawing' | null;
  readonly onWithdraw: () => Promise<void>;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  return (
    <section
      role="status"
      className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-card p-3"
      data-testid="showcase-registry-closed"
    >
      <h2 className="m-0 text-base font-semibold text-foreground">{t(SHOWCASE_REGISTRY_KEYS.closedTitle)}</h2>
      <p className="m-0 text-sm text-foreground">
        {t(SHOWCASE_REGISTRY_KEYS.closedBody, { date: formatLongDate(closure.checkedAt) })}
      </p>
      <footer className="flex flex-wrap items-center gap-3">
        <FixNumberLink />
        <ShowcaseWithdrawButton busy={busy} onWithdraw={onWithdraw} />
      </footer>
      <p className="m-0 text-xs text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.closedWithdrawHint)}</p>
    </section>
  );
}

/** «Υιοθέτηση επωνυμίας ΓΕΜΗ» — **μόνο** όταν ο κριτής λέει υιοθετήσιμη, με τις δύο επωνυμίες δίπλα-δίπλα. */
function AdoptionOffer({
  report,
  registry,
}: {
  readonly report: RegistryIdentityReport;
  readonly registry: CompanyRegistryIdentity;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const check = adoptableRegistryCheckOf(report.judgment);
  if (check === null) return null;
  const registryName = check.record.legalName;

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-card p-3" data-testid="showcase-registry-adopt">
      <h2 className="m-0 text-base font-semibold text-foreground">{t(SHOWCASE_REGISTRY_KEYS.adoptTitle)}</h2>
      <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.adoptLead)}</p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.adoptProfileName)}</dt>
        <dd className="m-0 text-foreground">{report.declaration.businessName ?? ''}</dd>
        <dt className="text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.adoptRegistryName)}</dt>
        <dd className="m-0 font-medium text-foreground" data-testid="showcase-registry-adopt-name">{registryName}</dd>
      </dl>
      <footer>
        <Button type="button" disabled={registry.adopting} onClick={() => void registry.adoptLegalName(registryName)}>
          {registry.adopting ? t(SHOWCASE_REGISTRY_KEYS.adopting) : t(SHOWCASE_REGISTRY_KEYS.adopt)}
        </Button>
      </footer>
    </section>
  );
}

/** Η κρίση σε μία πρόταση — με **ημερομηνία** όταν είναι επαληθευμένη (ποτέ σήμα χωρίς πότε). */
function JudgmentLine({ report }: { readonly report: RegistryIdentityReport }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { judgment } = report;
  if (judgment.state === 'verified') {
    return (
      <p className="m-0 text-sm text-foreground" data-testid="showcase-registry-verified">
        {t(SHOWCASE_REGISTRY_KEYS.verifiedOn, { date: formatLongDate(judgment.check.checkedAt) })}
      </p>
    );
  }
  if (judgment.gap === 'no-registration-number') {
    return <p className="m-0 text-sm text-foreground">{t(SHOWCASE_REGISTRY_KEYS.unregistered)}</p>;
  }
  return (
    <p className="m-0 text-sm text-foreground" data-testid="showcase-registry-gap">
      {t(SHOWCASE_REGISTRY_GAP_KEYS[judgment.gap])}
    </p>
  );
}

/**
 * **«Διαγραφή των στοιχείων ΓΕΜΗ που κρατάμε»** (Α23.12 · GDPR άρθ. 17/21) — **μόνο** όταν κρατάμε αντίγραφο
 * (`holdsRegistryCopy`), **πάντα** με επιβεβαίωση (`ConfirmDialog`, ADR-003): η πράξη δεν αναιρείται και ρίχνει το
 * σήμα και την ένδειξη κλεισίματος της βιτρίνας. Πρακτική: Google/Stripe — ο κάτοχος σβήνει μόνος του, χωρίς email.
 */
function CopyErasureControl({
  report,
  registry,
}: {
  readonly report: RegistryIdentityReport;
  readonly registry: CompanyRegistryIdentity;
}): React.ReactElement | null {
  const { t } = useTranslation([SHOWCASE_NS]);
  const [confirming, setConfirming] = React.useState(false);
  if (!holdsRegistryCopy(report.judgment)) return null;
  return (
    <>
      <Button type="button" variant="ghost" disabled={registry.erasing} onClick={() => setConfirming(true)}>
        {registry.erasing ? t(SHOWCASE_REGISTRY_KEYS.erasing) : t(SHOWCASE_REGISTRY_KEYS.erase)}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t(SHOWCASE_REGISTRY_KEYS.eraseTitle)}
        description={t(SHOWCASE_REGISTRY_KEYS.eraseBody)}
        confirmText={t(SHOWCASE_REGISTRY_KEYS.eraseConfirm)}
        variant="destructive"
        loading={registry.erasing}
        onConfirm={async () => {
          setConfirming(false);
          await registry.eraseCopy();
        }}
      />
    </>
  );
}

/** «Επαλήθευση από ΓΕΜΗ» **μόνο** με έγκυρο αριθμό· «Διόρθωση αριθμού» **μόνο** όταν εκεί είναι η θεραπεία. */
function VerifyControls({
  report,
  registry,
}: {
  readonly report: RegistryIdentityReport;
  readonly registry: CompanyRegistryIdentity;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const canVerify = canonicalGemiNumber(report.declaration.gemiNumber) !== null;
  return (
    <footer className="flex flex-wrap items-center gap-3">
      {canVerify ? (
        <Button type="button" variant="outline" disabled={registry.verifying} onClick={() => void registry.verify()}>
          {registry.verifying ? t(SHOWCASE_REGISTRY_KEYS.verifying) : t(SHOWCASE_REGISTRY_KEYS.verify)}
        </Button>
      ) : null}
      {needsRegistrationFix(report.judgment) ? <FixNumberLink /> : null}
      <CopyErasureControl report={report} registry={registry} />
    </footer>
  );
}

function RegistryReportView({
  report,
  registry,
}: {
  readonly report: RegistryIdentityReport;
  readonly registry: CompanyRegistryIdentity;
}): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { freshness } = report;
  return (
    <section className="flex flex-col gap-3" data-testid="showcase-registry-report">
      {freshness.kind === 'unavailable' ? (
        <p role="alert" className="m-0 text-sm text-destructive">
          {t(SHOWCASE_REGISTRY_UNAVAILABLE_KEYS[freshness.reason])}
        </p>
      ) : null}
      <JudgmentLine report={report} />
      <AdoptionOffer report={report} registry={registry} />
      {registry.adoption !== 'none' ? (
        <p role="status" className="m-0 text-sm text-foreground" data-testid="showcase-registry-adoption">
          {t(SHOWCASE_REGISTRY_ADOPTION_KEYS[registry.adoption])}
        </p>
      ) : null}
      {registry.erasure !== 'none' ? (
        <p role="status" className="m-0 text-sm text-foreground" data-testid="showcase-registry-erasure">
          {t(SHOWCASE_REGISTRY_ERASURE_KEYS[registry.erasure])}
        </p>
      ) : null}
      <VerifyControls report={report} registry={registry} />
    </section>
  );
}

/**
 * **Η κρίση ταυτότητας** — τέσσερις καταστάσεις του hook, τέσσερις διαφορετικές προτάσεις (N.12): «φορτώνει» ≠
 * «δεν είστε διαχειριστής» ≠ «δεν απάντησε» ≠ η αναφορά.
 */
export function RegistryJudgmentSection({ registry }: { readonly registry: CompanyRegistryIdentity }): React.ReactElement {
  const { t } = useTranslation([SHOWCASE_NS]);
  const { state } = registry;
  if (state.kind === 'loading') {
    return <p className="m-0 text-sm text-muted-foreground">{t(SHOWCASE_REGISTRY_KEYS.loading)}</p>;
  }
  if (state.kind === 'forbidden') {
    return (
      <p className="m-0 text-sm text-muted-foreground" data-testid="showcase-registry-forbidden">
        {t(SHOWCASE_REGISTRY_KEYS.forbidden)}
      </p>
    );
  }
  if (state.kind === 'unavailable') {
    return <p role="alert" className="m-0 text-sm text-destructive">{t(SHOWCASE_REGISTRY_KEYS.unavailable)}</p>;
  }
  return <RegistryReportView report={state.report} registry={registry} />;
}
