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

import { Card } from '@/components/ui/card';

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

/** **Το πλάτος των πάνελ μιας γκαλερί** και η κλάση που παράγει — ΕΝΑ σημείο (ADR-916 Φ-Δ, N.0.2: ήταν τρίδυμο). */
export function useHarnessPanelWidth(): { readonly width: PanelWidth; readonly setWidth: (next: PanelWidth) => void; readonly panelClass: string } {
  const [width, setWidth] = React.useState<PanelWidth>('auto');
  return { width, setWidth, panelClass: `flex flex-col gap-3 overflow-visible p-4 ${PANEL_WIDTH_CLASS[width]}` };
}

/**
 * **Ο σκελετός κάθε γκαλερί καταστάσεων** — τίτλος, περιγραφή, επιλογή πλάτους, πλήθος πάνελ, και οι ομάδες ως παιδιά.
 * Εξήχθη όταν ήρθε η τρίτη γκαλερί (ADR-916 Φ-Δ, N.0.2 / CHECK 3.28): ήταν αντιγραμμένος σε τρία harness.
 */
export function HarnessGallery({
  label,
  title,
  description,
  panelCount,
  width,
  onWidthChange,
  children,
}: {
  readonly label: string;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly panelCount: number;
  readonly width: PanelWidth;
  readonly onWidthChange: (next: PanelWidth) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6" aria-label={label}>
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="m-0 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </header>
      <Card asChild className="flex flex-wrap items-center gap-6 p-4 text-sm">
        <section aria-label="Harness controls">
          <PanelWidthSelect width={width} onChange={onWidthChange} />
          <span className="text-muted-foreground">{panelCount} panels</span>
        </section>
      </Card>
      {children}
    </section>
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

/** **Μια ομάδα πάνελ** με τίτλο — εξήχθη όταν ήρθε η τρίτη γκαλερί (ADR-916 Φ-Δ, N.0.2): ήταν δίδυμο σε δύο. */
export function HarnessPanelGroup({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="m-0 text-lg font-semibold text-foreground">{title}</h2>
      <section className="flex flex-wrap items-start gap-6">{children}</section>
    </section>
  );
}

/** **Ένα πάνελ = μία κατάσταση.** Η λεζάντα λέει μόνο την ταυτότητα — το «τι κάνει» το δείχνει η ίδια η οθόνη. */
export function HarnessPanel({ id, className, children }: { readonly id: string; readonly className: string; readonly children: React.ReactNode }) {
  return (
    <Card asChild className={className}>
      <article data-testid={`harness-panel-${id}`}>
        <h3 className="m-0 font-mono text-xs text-muted-foreground">{id}</h3>
        {children}
      </article>
    </Card>
  );
}
