'use client';

/**
 * @fileoverview ADR-915 §35 — **η απόφαση** μιας μόνιμης υποχρέωσης: «Επιβεβαίωση» · «Δεν ισχύει» (με λόγο) · «Αναίρεση».
 * @related RegistryUpkeepPanel.tsx (η ενότητα) · RegistryUpkeepExemptForm.tsx (ο λόγος, `next/dynamic`) ·
 *   hooks/document-registry/useUpkeepDeclaration.ts (η αποστολή)
 * @module components/document-registry/RegistryUpkeepDecision
 *
 * 🔑 Τα κουμπιά λένε «Αποθηκεύεται…» **μόνο** στο (ακίνητο, είδος) που στέλνεται· ο φρουρός του hook αγνοεί δεύτερη
 *    αποστολή όσο η πρώτη είναι σε πτήση.
 * ♿ **Η εστίαση δεν πέφτει ποτέ στο `<body>`** (WCAG 2.4.3, μετρημένο στον browser §37.6): σε πτήση `aria-disabled`, όχι
 *    `disabled` — ο Chrome πετά την εστίαση από στοιχείο που απενεργοποιείται· και αφού η πράξη **αντικαταστήσει** το
 *    κουμπί, η εστίαση πάει στο νέο («Αναίρεση» · «Επιβεβαίωση» · πίσω στο «Δεν ισχύει»). Μόνο αν χάθηκε — ποτέ κλοπή.
 */

import React, { Suspense, lazy, useLayoutEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { focusFirstWithin } from '@/lib/a11y/focus-first';
import type { UpkeepItem } from '@/lib/document-validity/property-upkeep';
import type { UpkeepDeclarationBody } from '@/lib/document-validity/upkeep-declaration-request';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { UPKEEP_KEYS } from '@/components/document-registry/upkeep-labels';

// Όριο κλειστότητας (CHECK 3.34): η φόρμα εξαίρεσης φαίνεται μόνο μετά το «Δεν ισχύει».
// ♿ `React.lazy`, ΟΧΙ `next/dynamic` (§37.7, μετρημένο στην παραγωγή): το `dynamic({ ssr: false })` βάζει **δικό του, νέο**
//    `<Suspense fallback={null}>` — και ένα νέο όριο δείχνει το fallback του αμέσως, ακόμη και σε μετάβαση. Άρα στο πρώτο
//    πάτημα το «Δεν ισχύει» έφευγε από το DOM πριν φτάσει το chunk ⇒ εστίαση στο `<body>`. Εδώ το όριο είναι το εξωτερικό
//    (ήδη ορατό) και το άνοιγμα γίνεται σε `startTransition`: το κουμπί ΜΕΝΕΙ εστιασμένο μέχρι να είναι έτοιμη η φόρμα.
const loadExemptForm = () => import('./RegistryUpkeepExemptForm');
const UpkeepExemptForm = lazy(() => loadExemptForm().then((mod) => ({ default: mod.UpkeepExemptForm })));
/** Πρόθεση (εστίαση/δείκτης πάνω στο κουμπί) ⇒ το chunk ξεκινά πριν το πάτημα· το `import()` δεν κατεβάζει δύο φορές. */
const warmExemptForm = (): void => {
  void loadExemptForm();
};

export interface UpkeepDecisionProps {
  readonly item: UpkeepItem;
  readonly busy: boolean;
  readonly onSubmit: (body: UpkeepDeclarationBody) => Promise<boolean>;
}

/** Πού επιστρέφει η εστίαση όταν η πράξη αντικαταστήσει το κουμπί που την είχε. */
type FocusReturn = 'first' | 'exempt';

/** Η εστίαση χάθηκε (στο `<body>`) ή είναι ακόμη εδώ — αλλιώς ο άνθρωπος πήγε αλλού και δεν τον τραβάμε πίσω. */
function focusIsOurs(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || (root?.contains(active) ?? false);
}

/**
 * Μόλις η πράξη τελειώσει (όχι σε πτήση, όχι μέσα στη φόρμα), η εστίαση πάει εκεί που ζήτησε το `returnTo`.
 * `useLayoutEffect`: το commit που αφαίρεσε το εστιασμένο κουμπί μετά από `await` ΔΕΝ είναι διακριτή είσοδος — ένα passive
 * effect θα έτρεχε μετά το βάψιμο, με την εστίαση στο `<body>` στο ενδιάμεσο (ίδιο σκεπτικό με `useFocusFirstOnMount`).
 */
function useFocusReturn(settled: boolean, declaration: UpkeepItem['declaration']) {
  const navRef = useRef<HTMLElement>(null);
  const exemptRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<FocusReturn | null>(null);
  useLayoutEffect(() => {
    const target = pending.current;
    if (target === null || !settled) return;
    pending.current = null;
    if (!focusIsOurs(navRef.current)) return;
    if (target === 'exempt' && exemptRef.current !== null) exemptRef.current.focus({ preventScroll: true });
    else focusFirstWithin(navRef.current);
  }, [settled, declaration]);
  const returnTo = (target: FocusReturn): void => {
    pending.current = target;
  };
  return { navRef, exemptRef, returnTo };
}

/** Το εξωτερικό, ήδη ορατό όριο: πάνω του η μετάβαση «κρατά» το κουμπί αντί να δείξει κενό. */
export function RegistryUpkeepDecision(props: UpkeepDecisionProps): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <UpkeepDecisionBody {...props} />
    </Suspense>
  );
}

/** Χωρίς απόφαση: «Επιβεβαίωση» · «Δεν ισχύει». Με απόφαση: «Αναίρεση» (γυρίζει η πρόταση — κι αυτό με ίχνος). */
function UpkeepDecisionBody({ item, busy, onSubmit }: UpkeepDecisionProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const [exempting, setExempting] = useState(false);
  const [opening, startOpening] = useTransition();
  const { navRef, exemptRef, returnTo } = useFocusReturn(!busy && !exempting, item.declaration);
  const openForm = (): void => {
    if (!busy) startOpening(() => setExempting(true));
  };
  const send = (decision: UpkeepDeclarationBody['decision']): void => {
    if (busy) return;
    returnTo('first');
    void onSubmit({ propertyId: item.propertyId, documentKind: item.documentKind, decision, exemptionReason: null });
  };
  const closeForm = (): void => {
    returnTo('exempt');
    setExempting(false);
  };
  if (exempting) return <UpkeepExemptForm item={item} busy={busy} onSubmit={onSubmit} onCancel={closeForm} />;
  if (item.declaration !== null) {
    return (
      <nav ref={navRef} className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => send(null)} aria-disabled={busy}>
          {t(busy ? UPKEEP_KEYS.saving : UPKEEP_KEYS.reask)}
        </Button>
      </nav>
    );
  }
  return (
    <nav ref={navRef} className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => send('required')} aria-disabled={busy}>
        {t(busy ? UPKEEP_KEYS.saving : UPKEEP_KEYS.confirm)}
      </Button>
      <Button
        ref={exemptRef} type="button" size="sm" variant="secondary" onClick={openForm}
        onFocus={warmExemptForm} onPointerEnter={warmExemptForm} aria-disabled={busy} aria-busy={opening}
      >
        {t(UPKEEP_KEYS.exempt)}
      </Button>
    </nav>
  );
}
