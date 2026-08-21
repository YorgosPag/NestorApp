'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — τι είναι, τι φταίει, τι κάνω.
 * @related ADR-777 §8.34 · lib/mandate/mandate-actions.ts · CHECK 3.41 (WCAG 1.4.1)
 * @module components/mandate/catalog/MandateCatalogRow
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΜΙΑ ΚΑΤΑΣΤΑΣΗ ΔΕΝ ΞΕΧΩΡΙΖΕΙ ΜΕ ΧΡΩΜΑ — ΚΑΙ ΕΙΝΑΙ ΚΑΝΟΝΑΣ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι δέκα καταστάσεις διακρίνονται από **λέξεις και θέση**: τίτλος κατάστασης, πρόταση
 * «τι να κάνεις», και **σε ποια ομάδα** κάθεται η γραμμή. Καμία απόχρωση δεν κουβαλά
 * νόημα.
 *
 * Είναι το μάθημα του **CHECK 3.41** (WCAG 1.4.1, *Use of Color*), όπου δύο σημάδια
 * κελιού ξεχώριζαν **μόνο** στην απόχρωση. Και είναι επίσης η **μόνη** επιλογή που
 * επιβιώνει στις πύλες αντίθεσης: το `--destructive` σε σκοτεινό θέμα λύνεται σε
 * `0 62.8% 30.6%` πάνω σε κάρτα `217 33% 17%` — σκούρο κόκκινο σε σκούρο μπλε, δηλαδή
 * ένα «επείγον» που **δεν διαβάζεται** (CHECK 3.38/3.39).
 *
 * ⚠️ **Τα κουμπιά τα διαλέγει ο ΕΝΑΣ κριτής** ({@link allowedActionsFor}), ο ίδιος που
 * επιβάλλει ο διακομιστής. Χειρόγραφο `if (standing === …)` εδώ θα ήταν δεύτερη
 * υλοποίηση, και η απόκλισή της είναι σιωπηλή προς **δύο** κατευθύνσεις.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { allowedActionsFor, type MandateAction } from '@/lib/mandate/mandate-actions';
import type { MandateCatalogRow as CatalogRow } from '@/services/mandate/mandate-catalog.service';

import {
  ACTION_DONE_KEYS,
  ACTION_LABEL_KEYS,
  CATALOG_KEYS,
  CATALOG_NS,
  PROOF_LABEL_KEYS,
  REJECTION_KEYS,
  STANDING_HINT_KEYS,
  STANDING_LABEL_KEYS,
} from './mandate-catalog-labels';
import type { CatalogFeedback } from '@/hooks/mandate/useMandateCatalog';

export interface MandateCatalogRowProps {
  readonly row: CatalogRow;
  readonly busy: boolean;
  readonly feedback: CatalogFeedback | null;
  readonly onAct: (ownerPropertyId: string, action: MandateAction) => void;
}

/**
 * Το μήνυμα της **τελευταίας πράξης** πάνω σε αυτή τη γραμμή.
 *
 * ⚠️ Τρεις καταστάσεις, ρητά — και το `failed` **δεν** παίρνει το μήνυμα του δικτύου
 * ωμό: ένα `TypeError: Failed to fetch` στην οθόνη δεν λέει τίποτα σε μεσίτη.
 */
function FeedbackLine({ feedback }: { readonly feedback: CatalogFeedback }): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const { result } = feedback;

  if (result.kind === 'failed') {
    return <p className="text-sm text-muted-foreground">{t(CATALOG_KEYS.networkFailure)}</p>;
  }
  if (result.kind === 'rejected') {
    return <p className="text-sm text-muted-foreground">{t(REJECTION_KEYS[result.reason])}</p>;
  }

  const { outcome } = result;
  if (!outcome.ok) {
    return <p className="text-sm text-muted-foreground">{t(REJECTION_KEYS[outcome.reason])}</p>;
  }
  if (outcome.action === 'revoke') {
    return <p className="text-sm text-muted-foreground">{t(ACTION_DONE_KEYS.revoke)}</p>;
  }
  return (
    <p className="text-sm text-muted-foreground">
      {t(ACTION_DONE_KEYS.resend, {
        to: outcome.notify.kind === 'sent' ? outcome.notify.to : '',
      })}
    </p>
  );
}

/** Τα **γεγονότα** της γραμμής, ως λίστα ορισμών — όχι διακοσμητικά «badges». */
function RowFacts({ row }: { readonly row: CatalogRow }): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);

  return (
    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <dt>{t(CATALOG_KEYS.clientLabel)}:</dt>
        <dd className="m-0 text-foreground">
          {row.clientName ?? t(CATALOG_KEYS.clientUnknown)}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">{t(PROOF_LABEL_KEYS[row.proofVia])}</dt>
        <dd className="m-0">{t(PROOF_LABEL_KEYS[row.proofVia])}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">{t(CATALOG_KEYS.expiredLabel)}</dt>
        <dd className="m-0">
          {row.daysLeft === null
            ? t(CATALOG_KEYS.expiredLabel)
            : t(CATALOG_KEYS.expiresIn, { count: row.daysLeft })}
        </dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">{t(CATALOG_KEYS.onTheMarket)}</dt>
        <dd className="m-0">
          {row.onTheMarket ? t(CATALOG_KEYS.onTheMarket) : t(CATALOG_KEYS.offTheMarket)}
        </dd>
      </div>
      {row.notifiedAt === null ? (
        <div className="flex gap-1">
          <dt className="sr-only">{t(CATALOG_KEYS.notifiedNever)}</dt>
          <dd className="m-0">{t(CATALOG_KEYS.notifiedNever)}</dd>
        </div>
      ) : row.viewedAt === null ? (
        <div className="flex gap-1">
          <dt className="sr-only">{t(CATALOG_KEYS.viewedNever)}</dt>
          <dd className="m-0">{t(CATALOG_KEYS.viewedNever)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function MandateCatalogRow({
  row,
  busy,
  feedback,
  onAct,
}: MandateCatalogRowProps): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const actions = allowedActionsFor(row.standing);

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h3 className="m-0 text-base font-semibold text-foreground">{row.listingTitle}</h3>
        <p className="m-0 text-sm font-medium text-foreground">
          {t(STANDING_LABEL_KEYS[row.standing])}
        </p>
        <p className="m-0 text-sm text-muted-foreground">
          {t(STANDING_HINT_KEYS[row.standing])}
        </p>
      </header>

      <RowFacts row={row} />

      {actions.length === 0 ? null : (
        <footer className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === 'revoke' ? 'destructive' : 'secondary'}
              disabled={busy}
              onClick={() => onAct(row.ownerPropertyId, action)}
            >
              {busy ? t(CATALOG_KEYS.working) : t(ACTION_LABEL_KEYS[action])}
            </Button>
          ))}
        </footer>
      )}

      {feedback === null ? null : <FeedbackLine feedback={feedback} />}
    </article>
  );
}
