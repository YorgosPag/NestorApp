'use client';

/**
 * @fileoverview **ΠΟΙΟΣ ΒΛΕΠΕΙ ΑΥΤΗ ΤΗΝ ΚΑΤΑΧΩΡΗΣΗ** — η πράξη αλλαγής κοινού (ADR-864 Ε-10).
 * @related ADR-864 §5.1 · §5.2 · constants/marketing-audiences.ts
 * @module components/listings/MarketingAudienceControl
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ COMPONENT, ΔΥΟ ΣΠΙΤΙΑ, ΜΙΑ ΘΥΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το κοινό ζει σε **δύο** συλλογές (`owner_properties` · `properties`) με **δύο** διαδρομές
 * γραφής. Η **διεπαφή** όμως είναι μία ερώτηση — γι' αυτό η πράξη περνιέται ως `onChange`
 * και το component **δεν ξέρει** ποια συλλογή γράφει. Δύο αντίγραφα θα απέκλιναν στην
 * επιβεβαίωση του στενέματος, που είναι ακριβώς το σημείο που **δεν** πρέπει να αποκλίνει.
 *
 * ⚠️ **ΟΧΙ ΑΙΣΙΟΔΟΞΟ** — ίδιο σκεπτικό με την απόσυρση (`OwnerPropertyDetailContent`): η
 * πράξη αλλάζει **τι βλέπει ο κόσμος**. Μια όψη που λέει «μόνο οι διαχειριστές» ενώ η
 * αγγελία είναι ακόμη στον χάρτη είναι ψέμα που ο κάτοχος δεν μπορεί να ανακαλύψει. Η τιμή
 * που δείχνεται είναι **πάντα** η αποθηκευμένη (`audience`), ποτέ τοπικό αντίγραφο.
 *
 * 🔶 **Το `network` εμφανίζεται ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟ, επίτηδες**: προϋποθέτει το επαγγελματικό
 * δίκτυο του ADR-862 (Φ5). Επιλέξιμο σήμερα θα συμπεριφερόταν **ακριβώς** σαν `custodians`
 * — επιλογή που υπόσχεται κάτι που δεν συμβαίνει. Ορατό, ώστε ο άνθρωπος να ξέρει ότι έρχεται.
 */

import React from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  MARKETING_AUDIENCES,
  isMarketingAudience,
  narrowsAudience,
  type MarketingAudience,
} from '@/constants/marketing-audiences';

const NS = 'property-market';
const ENUMS_NS = 'properties-enums';
const K = `${NS}:audience`;

/** Κοινά που **δεν** ζουν ακόμη — ορατά, μη επιλέξιμα. */
const PENDING_AUDIENCES: ReadonlySet<MarketingAudience> = new Set<MarketingAudience>(['network']);

/**
 * **Γιατί ο διακομιστής αρνήθηκε** — κλειστό σύνολο, κωδικός = κλειδί i18n (ADR-864 Α21).
 *
 * 🔴 Ως τη Φ3 η πράξη επέστρεφε `Promise<boolean>` ⇒ «δεν χρειάζεται συναίνεση του ιδιοκτήτη» και
 * «έπεσε το δίκτυο» ήταν **το ίδιο** `false`, και ο άνθρωπος διάβαζε «δοκίμασε ξανά» για κάτι που
 * καμία επανάληψη δεν διορθώνει.
 */
type AudienceRefusal = 'private-marketing-consent-missing';

export type AudienceChangeOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'refused'; readonly reason: AudienceRefusal }
  | { readonly kind: 'failed' };

/** Οι καταστάσεις της πράξης. **Ποτέ** `boolean` + `string`. */
type ChangeState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'refused'; readonly reason: AudienceRefusal };

const IDLE: ChangeState = { kind: 'idle' };

export interface MarketingAudienceControlProps {
  /** Το **αποθηκευμένο** κοινό — η μόνη πηγή της εμφανιζόμενης τιμής. */
  readonly audience: MarketingAudience;
  /** Η πράξη· η νέα τιμή φτάνει από τη ζωντανή ανάγνωση του καλούντα. */
  readonly onChange: (next: MarketingAudience) => Promise<AudienceChangeOutcome>;
}

export function MarketingAudienceControl({
  audience,
  onChange,
}: MarketingAudienceControlProps): React.ReactElement {
  const { t } = useTranslation([NS, ENUMS_NS]);
  const [state, setState] = React.useState<ChangeState>(IDLE);
  const [pendingNarrowing, setPendingNarrowing] = React.useState<MarketingAudience | null>(null);
  const headingId = React.useId();

  const commit = React.useCallback(
    async (next: MarketingAudience): Promise<void> => {
      setState({ kind: 'busy' });
      const outcome = await onChange(next);
      setState(outcome.kind === 'saved' ? IDLE : outcome);
    },
    [onChange],
  );

  const handleSelect = (value: string): void => {
    if (!isMarketingAudience(value) || value === audience) return;
    if (narrowsAudience(audience, value)) {
      setPendingNarrowing(value);
      return;
    }
    void commit(value);
  };

  const confirmNarrowing = async (): Promise<void> => {
    const next = pendingNarrowing;
    setPendingNarrowing(null);
    if (next !== null) await commit(next);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        {t(`${K}.label`)}
      </h2>

      <Select value={audience} onValueChange={handleSelect} disabled={state.kind === 'busy'}>
        <SelectTrigger className="min-w-56 self-start">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MARKETING_AUDIENCES.map((option) => (
            <SelectItem key={option} value={option} disabled={PENDING_AUDIENCES.has(option)}>
              {t(`${ENUMS_NS}:marketingAudience.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-sm text-muted-foreground">{t(`${K}.describe.${audience}`)}</p>
      <p className="text-sm text-muted-foreground">{t(`${K}.networkPending`)}</p>

      {state.kind === 'failed' && (
        <p aria-live="polite" className="text-sm text-foreground">
          {t(`${K}.failed`)}
        </p>
      )}
      {state.kind === 'refused' && (
        <p aria-live="polite" className="text-sm text-foreground">
          {t(`${K}.refused.${state.reason}`)}
        </p>
      )}

      <ConfirmDialog
        open={pendingNarrowing !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNarrowing(null);
        }}
        title={t(`${K}.narrowing.title`)}
        description={t(`${K}.narrowing.description`)}
        confirmText={t(`${K}.narrowing.confirm`)}
        variant="warning"
        onConfirm={confirmNarrowing}
      />
    </section>
  );
}
