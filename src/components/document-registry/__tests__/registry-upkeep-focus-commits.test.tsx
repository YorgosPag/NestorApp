/**
 * @fileoverview ADR-915 §37.7 — **σε ΚΑΝΕΝΑ commit η εστίαση δεν είναι στο `<body>`** (όχι μόνο «στο τέλος»).
 *
 * 🔴 Μετρημένο στην παραγωγή (2026-10-22, `678441dd`, ×3): «Δεν ισχύει» με Enter ⇒ `BUTTON` → **`BODY`** → `radio`.
 *    Η τελική εστίαση ήταν σωστή, γι' αυτό το `findByRole(...).toHaveFocus()` του `registry-upkeep-focus.test.tsx` ήταν
 *    πράσινο: περιμένει, άρα **περνά πάνω από το κενό**.
 * 🔑 **Ο παρατηρητής είναι το commit, όχι το ρολόι.** Ένας δειγματολήπτης 10ms (όπως στον browser) μπορεί να το χάσει·
 *    το `<Profiler onRender>` καλείται σε **κάθε** commit, **μετά** τα layout effects των παιδιών και **πριν** τα passive
 *    — δηλαδή ακριβώς τη στιγμή που ο browser θα μπορούσε να βάψει. `BODY` εκεί = κενό που βλέπει ο αναγνώστης οθόνης.
 * 🔑 **Αργό chunk = πύλη που ελέγχουμε εμείς.** Στο jsdom το `import()` λύνεται σε microtask και το React 19 ξαναπαίζει
 *    το `lazy` **χωρίς** fallback (μετρημένο: η μετάλλαξη «χωρίς μετάβαση» ΕΠΕΖΗΣΕ με το σκέτο `import()`). Στον browser το
 *    chunk έρχεται από το δίκτυο. Γι' αυτό η φόρμα τυλίγεται σε `use(gate)`: ίδια σημασιολογία Suspense, χρόνος δικός μας.
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { Profiler, use } from 'react';

import { RegistryUpkeepDecision } from '../RegistryUpkeepDecision';
import { UPKEEP_EXEMPTION_KEYS, UPKEEP_KEYS } from '../upkeep-labels';
import { UPKEEP_EXEMPTION_REASONS, type UpkeepDeclaration, type UpkeepItem } from '@/lib/document-validity/property-upkeep';

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/** `null` = το chunk είναι εδώ· υπόσχεση = το chunk ταξιδεύει ακόμη (η φόρμα αναστέλλεται μέχρι να λυθεί). */
let chunkGate: Promise<void> | null = null;
jest.mock('../RegistryUpkeepExemptForm', () => {
  const real = jest.requireActual<typeof import('../RegistryUpkeepExemptForm')>('../RegistryUpkeepExemptForm');
  return {
    UpkeepExemptForm: (props: React.ComponentProps<typeof real.UpkeepExemptForm>) => {
      if (chunkGate !== null) use(chunkGate);
      return <real.UpkeepExemptForm {...props} />;
    },
  };
});

const PROPOSED = { verdict: 'proposed', reason: 'in-use', propertyClass: 'residential', phase: 'ready' } as const;
const EXEMPTED: UpkeepDeclaration = {
  propertyId: 'p1', documentKind: 'electrical-installation', decision: 'not-required', exemptionReason: UPKEEP_EXEMPTION_REASONS[0],
  proposalAtDecision: PROPOSED, declaredByUid: 'user_1', declaredAt: '2026-10-22T09:00:00.000Z',
};
const itemOf = (declaration: UpkeepDeclaration | null): UpkeepItem =>
  ({ propertyId: 'p1', documentKind: 'electrical-installation', proposal: PROPOSED, declaration });

/** Τι κρατούσε την εστίαση σε κάθε commit μετά την έναρξη της καταγραφής. */
let commits: string[] = [];
let recording = false;
const record = (): void => {
  if (recording) commits.push(document.activeElement === document.body ? 'BODY' : document.activeElement?.tagName ?? 'NULL');
};

const onSubmit = jest.fn<Promise<boolean>, [unknown]>();
const view = (declaration: UpkeepDeclaration | null, busy: boolean) => (
  <Profiler id="upkeep" onRender={record}>
    <RegistryUpkeepDecision item={itemOf(declaration)} busy={busy} onSubmit={onSubmit} />
  </Profiler>
);
const button = (name: string) => screen.getByRole('button', { name });
const firstReason = () => screen.findByRole('radio', { name: UPKEEP_EXEMPTION_KEYS[UPKEEP_EXEMPTION_REASONS[0]] });
const startRecording = (): void => {
  commits = [];
  recording = true;
};

beforeEach(() => {
  recording = false;
  chunkGate = null;
  onSubmit.mockReset().mockResolvedValue(true);
});

describe('RegistryUpkeepDecision — η εστίαση σε ΚΑΘΕ commit', () => {
  it('«Δεν ισχύει» με chunk σε πτήση ⇒ το κουμπί ΜΕΝΕΙ εστιασμένο ως τη φόρμα· κανένα commit στο <body>', async () => {
    let arrive: () => void = () => undefined;
    chunkGate = new Promise<void>((done) => { arrive = done; });
    render(view(null, false));
    act(() => button(UPKEEP_KEYS.exempt).focus());
    startRecording();
    await userEvent.keyboard('{Enter}');
    expect(button(UPKEEP_KEYS.exempt)).toHaveFocus();
    expect(button(UPKEEP_KEYS.exempt)).toHaveAttribute('aria-busy', 'true');
    await act(async () => arrive());
    expect(await firstReason()).toHaveFocus();
    expect(commits.length).toBeGreaterThan(0);
    expect(commits).not.toContain('BODY');
  });

  it('«Δεν ισχύει» (chunk φορτωμένο) ⇒ κανένα commit στο <body>', async () => {
    render(view(null, false));
    act(() => button(UPKEEP_KEYS.exempt).focus());
    startRecording();
    await userEvent.keyboard('{Enter}');
    expect(await firstReason()).toHaveFocus();
    expect(commits).not.toContain('BODY');
  });

  it('αποθήκευση εξαίρεσης μετά από `await` (ΟΧΙ διακριτή είσοδος) ⇒ «Αναίρεση» χωρίς commit στο <body>', async () => {
    let resolve: (saved: boolean) => void = () => undefined;
    onSubmit.mockReturnValueOnce(new Promise<boolean>((done) => { resolve = done; }));
    const { rerender } = render(view(null, false));
    await userEvent.click(button(UPKEEP_KEYS.exempt));
    await userEvent.click(await firstReason());
    await userEvent.click(button(UPKEEP_KEYS.saveExempt));
    startRecording();
    rerender(view(null, true));
    rerender(view(EXEMPTED, false));
    await act(async () => resolve(true));
    expect(button(UPKEEP_KEYS.reask)).toHaveFocus();
    expect(commits).not.toContain('BODY');
  });
});
