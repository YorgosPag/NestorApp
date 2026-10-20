'use client';

/**
 * @fileoverview **Τα κοινά κομμάτια κάθε γκαλερί καταστάσεων** — πλάτος πάνελ (375px = το κινητό από το οποίο έρχεται ο
 * άνθρωπος) και το «πάτα όπως ο άνθρωπος» (η `play` του Storybook).
 * @related ADR-844 §11 · ADR-916 Φ-Β2 (εξήχθη τότε, N.0.2) · `scripted-transport.ts`
 * @module components/testing/harness/harness-panel
 *
 * ⚠️ **Ετικέτες εργαλείου στα αγγλικά, εκτός locales** — ίδια απόφαση με κάθε harness αυτού του δέντρου: η διαδρομή
 * **δεν υπάρχει** σε παραγωγή (`isTestHarnessRouteEnabled`), και τα κείμενα που **κρίνονται** είναι της οθόνης
 * παραγωγής, με τα δικά της κλειδιά.
 */

import React from 'react';

/** Πόσο πλατύ αποδίδεται κάθε πάνελ. */
export type PanelWidth = 'auto' | '375';

/**
 * **Πλήρες `Record`, ποτέ τερνάριο** — τρίτο πλάτος δεν μεταγλωττίζεται χωρίς να πει κάποιος πόσο είναι.
 * ⚠️ Κλάσεις **γραμμένες ολόκληρες**: ο σαρωτής του Tailwind διαβάζει κείμενο — `w-[${n}px]` δεν παράγει κανόνα.
 */
export const PANEL_WIDTH_CLASS: Readonly<Record<PanelWidth, string>> = {
  auto: 'w-[420px]',
  '375': 'w-[375px]',
};

export function PanelWidthSelect({ width, onChange }: { readonly width: PanelWidth; readonly onChange: (next: PanelWidth) => void }) {
  return (
    <label className="flex items-center gap-2 text-foreground">
      width
      <select
        className="rounded-md border border-border bg-background px-2 py-1"
        value={width}
        onChange={(event) => onChange(event.target.value === '375' ? '375' : 'auto')}
      >
        <option value="auto">auto</option>
        <option value="375">375px (phone)</option>
      </select>
    </label>
  );
}

/**
 * Πόσες φορές ξαναρωτά η γκαλερί το κουμπί, και κάθε πότε. ⚠️ Η κανονική διαδρομή **δεν** τα χρησιμοποιεί: η πρώτη
 * δοκιμή γίνεται **σύγχρονα**. Είναι δίχτυ, όχι ρολόι — και το `setTimeout` **τρέχει** σε αδρανή καρτέλα.
 */
const READY_ATTEMPT_BUDGET = 40;
const READY_ATTEMPT_MS = 50;

/**
 * **Πατά μόλις η οθόνη δηλώσει ότι είναι έτοιμη** (κουμπί που υπάρχει **και** δεν είναι `disabled`).
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `requestAnimationFrame` — ΜΕΤΡΗΘΗΚΕ ΖΩΝΤΑΝΑ (ADR-844 §11, 06/09)**: ο φυλλομετρητής **σταματά** το `rAF`
 * σε καρτέλα που δεν βλέπεται — η γκαλερί δούλευε μόνο όσο την κοιτούσες. Η πρώτη δοκιμή γίνεται **αμέσως**· το
 * `setTimeout` μένει δίχτυ. Επιστρέφει καθαριστή **πάντα**: πάνελ που αποπροσαρτάται δεν αφήνει βρόχο να τρέχει.
 */
export function clickWhenEnabled(root: HTMLElement, selector: string): () => void {
  let timer = 0;
  let tries = 0;
  let cancelled = false;

  const attempt = (): void => {
    if (cancelled) return;
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (button !== null && !button.disabled) {
      button.click();
      return;
    }
    if (++tries > READY_ATTEMPT_BUDGET) return;
    timer = window.setTimeout(attempt, READY_ATTEMPT_MS);
  };

  attempt();
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
