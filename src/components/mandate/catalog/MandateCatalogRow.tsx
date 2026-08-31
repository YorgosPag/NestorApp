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
import { CLIENT_NAME_KNOWN } from '@/lib/mandate/mandate-client-name';
import { NEVER_NOTIFIED } from '@/lib/mandate/mandate-standing';
import { presenceActionFor, type PresenceAction } from '@/lib/owner-property/listing-presence';
import type { MandateCatalogRow as CatalogRow } from '@/services/mandate/mandate-catalog.service';

import {
  ACTION_DONE_KEYS,
  ACTION_LABEL_KEYS,
  PRESENCE_DONE_KEYS,
  PRESENCE_LABEL_KEYS,
  CATALOG_KEYS,
  CATALOG_NS,
  CLIENT_NAME_KEYS,
  NEVER_NOTIFIED_HINT_KEYS,
  NOTIFY_UNRECORDED,
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
  /** ADR-777 §8.39 — «κατέβασέ το» / «ανέβασέ το», στον χώρο του γραφείου. */
  readonly onSetPresence: (ownerPropertyId: string, action: PresenceAction) => void;
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

  // ADR-777 §8.39 — η πράξη **παρουσίας** έχει δικό της λεξιλόγιο: δεν μπορεί να
  // αρνηθεί για λόγους πρόσκλησης, άρα δεν δανείζεται τα `REJECTION_KEYS`.
  if (result.kind === 'presence-done') {
    return <p className="text-sm text-muted-foreground">{t(PRESENCE_DONE_KEYS[result.action])}</p>;
  }
  if (result.kind === 'presence-failed') {
    return <p className="text-sm text-muted-foreground">{t(CATALOG_KEYS.networkFailure)}</p>;
  }
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
        {/*
          🔴 **ΤΡΕΙΣ ΚΟΣΜΟΙ, ΤΡΙΑ ΚΕΙΜΕΝΑ** (ADR-834 §6.5.δ). Ήταν `row.clientName ??
          t(clientUnknown)` — δηλαδή *«Η επαφή δεν βρέθηκε»* και για επαφή που
          **βρέθηκε** χωρίς όνομα. Ο μεσίτης έψαχνε διαγραμμένη επαφή που δεν
          διαγράφηκε ποτέ.
        */}
        <dd className="m-0 text-foreground">
          {row.clientName.kind === CLIENT_NAME_KNOWN
            ? row.clientName.name
            : t(CLIENT_NAME_KEYS[row.clientName.kind])}
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
  onSetPresence,
}: MandateCatalogRowProps): React.ReactElement {
  const { t } = useTranslation([CATALOG_NS]);
  const actions = allowedActionsFor(row.standing);
  const presence = presenceActionFor(row.onTheMarket);

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <header className="flex flex-col gap-1">
        <h3 className="m-0 text-base font-semibold text-foreground">{row.listingTitle}</h3>
        <p className="m-0 text-sm font-medium text-foreground">
          {t(STANDING_LABEL_KEYS[row.standing])}
        </p>
        {/*
          🔴 **Η ΘΕΡΑΠΕΙΑ ΔΙΑΒΑΖΕΙ ΔΥΟ ΑΞΟΝΕΣ, ΟΧΙ ΕΝΑΝ** (ADR-834 §6.5.δ). Ήταν
          `STANDING_HINT_KEYS[row.standing]` — και για το «Δεν στάλθηκε ποτέ» έλεγε
          *«η επαφή δεν είχε email»* χωρίς κανείς να το έχει καταγράψει. Η αιτία
          ταξιδεύει τώρα στο `row.notifyOutcome`.

          ⛔ **ΜΗΝ το τυλίξεις σε συνάρτηση** — δοκιμάστηκε και **μετρήθηκε**: ο
          generator του route slice (ADR-744) διαβάζει τριαδικό και πίνακα σταθερών,
          αλλά **όχι κλήση**, και αρνήθηκε να εκπέμψει ⇒ ωμά κλειδιά σε αυτή την
          οθόνη. Δες το `NEVER_NOTIFIED_HINT_KEYS` για ολόκληρη τη μέτρηση.
        */}
        <p className="m-0 text-sm text-muted-foreground">
          {t(
            row.standing === NEVER_NOTIFIED
              ? NEVER_NOTIFIED_HINT_KEYS[row.notifyOutcome ?? NOTIFY_UNRECORDED]
              : STANDING_HINT_KEYS[row.standing],
          )}
        </p>
      </header>

      <RowFacts row={row} />

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

        {/*
          🔴 ADR-777 §8.39 — ΤΟ ΚΟΥΜΠΙ ΠΟΥ ΕΛΕΙΠΕ. Η απόσυρση ζούσε **μόνο** στην οθόνη
          του ιδιώτη, πίσω από κριτήριο `authorUserId === uid`: μια αγγελία που ανήκει
          στο **γραφείο** δεν μπορούσε να κατέβει από κανέναν άλλον — ούτε όταν ο
          υπάλληλος που την καταχώρησε είχε φύγει.

          ⚠️ **Πάντα ορατό, ποτέ υπό όρους κατάστασης εντολής**: η έξοδος από την αγορά
          δεν επιτρέπεται να εξαρτάται από το αν η πρόσκληση είναι `pending` ή `expired`
          — «*μια πύλη που εμποδίζει τον άνθρωπο να αποσύρει το ακίνητό του τον κλειδώνει
          έξω από την έξοδο*» (setOwnerPropertyLifecycle).
        */}
        <Button
          type="button"
          size="sm"
          variant={presence === 'withdraw' ? 'destructive' : 'secondary'}
          disabled={busy}
          onClick={() => onSetPresence(row.ownerPropertyId, presence)}
        >
          {busy ? t(CATALOG_KEYS.working) : t(PRESENCE_LABEL_KEYS[presence])}
        </Button>
      </footer>

      {feedback === null ? null : <FeedbackLine feedback={feedback} />}
    </article>
  );
}
