/**
 * ADR-860 §Ε6 — module που λείπει από τον webpack runtime (RSC άλλου build).
 *
 * Οι δύο υποσχέσεις:
 *   • η ταξινόμηση κρίνει με ΤΟΠΟ (πρώτο frame στον webpack runtime), όχι μόνο με κείμενο·
 *   • το σήμα ΠΟΤΕ δεν ανανεώνει χωρίς `skewed` από τον server (ADR-858).
 */

import { isMissingModuleError } from '../missing-module-error';
import { offerToSkewRecovery } from '../install-module-skew-recovery';
import type { RecoveryOutcome, SkewDeps } from '../recovery-coordinator';
import type { SkewVerdict } from '../skew-probe';

const RUNTIME = 'https://nestorconstruct.gr/_next/static/chunks/webpack-b31acbef4b485bea.js';
const APP_CHUNK = 'https://nestorconstruct.gr/_next/static/chunks/41831-bcd058ecb843dc75.js';

function typeError(message: string, frames: readonly string[]): TypeError {
  const error = new TypeError(message);
  error.stack = [`TypeError: ${message}`, ...frames].join('\n');
  return error;
}

/** Η στοίβα του περιστατικού 2026-09-25, αυτούσια. */
const INCIDENT = typeError("Cannot read properties of undefined (reading 'call')", [
  `    at e (${RUNTIME}:1:527)`,
  `    at c (${APP_CHUNK}:7:9250)`,
  `    at D (${APP_CHUNK}:7:12644)`,
]);

describe('isMissingModuleError — τόπος + κείμενο', () => {
  test('η στοίβα του περιστατικού (V8) ⇒ true', () => {
    expect(isMissingModuleError(INCIDENT)).toBe(true);
  });

  test('Firefox (`fn@url`) ⇒ true', () => {
    const ff = typeError('can\'t access property "call", e[r] is undefined', [`e@${RUNTIME}:1:527`]);
    expect(isMissingModuleError(ff)).toBe(true);
  });

  test("ίδιο μήνυμα, πρώτο frame ΕΞΩ από τον runtime ⇒ false (δικό μας bug)", () => {
    const ours = typeError("Cannot read properties of undefined (reading 'call')", [
      `    at handler (${APP_CHUNK}:3:10)`,
      `    at e (${RUNTIME}:1:527)`,
    ]);
    expect(isMissingModuleError(ours)).toBe(false);
  });

  test('frame στον runtime, άλλο μήνυμα ⇒ false', () => {
    const other = typeError("Cannot read properties of undefined (reading 'length')", [`    at e (${RUNTIME}:1:9)`]);
    expect(isMissingModuleError(other)).toBe(false);
  });

  test('ReferenceError του ADR-858 / μη-Error ⇒ false', () => {
    const tdz = new ReferenceError("Cannot access 'o' before initialization");
    tdz.stack = `ReferenceError: x\n    at e (${RUNTIME}:1:527)`;
    expect(isMissingModuleError(tdz)).toBe(false);
    expect(isMissingModuleError('call')).toBe(false);
    expect(isMissingModuleError(undefined)).toBe(false);
  });
});

interface Harness {
  readonly deps: SkewDeps;
  readonly outcomes: RecoveryOutcome[];
  readonly reload: jest.Mock;
  readonly announceUpdate: jest.Mock;
}

function harness(verdict: SkewVerdict, overrides: Partial<SkewDeps> = {}): Harness {
  const outcomes: RecoveryOutcome[] = [];
  const reload = jest.fn();
  const announceUpdate = jest.fn();
  let pending = false;
  const deps: SkewDeps = {
    probe: () => Promise.resolve(verdict),
    hasUnsavedWork: () => false,
    claimReloadFor: () => {
      if (pending) return false;
      pending = true;
      return true;
    },
    isReloadPending: () => pending,
    reload,
    announceUpdate,
    report: (outcome) => outcomes.push(outcome),
    ...overrides,
  };
  return { deps, outcomes, reload, announceUpdate };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('offerToSkewRecovery — ανανέωση ΜΟΝΟ με απόδειξη από τον server', () => {
  test('skewed ⇒ μία ανανέωση, reloaded-for-skew', async () => {
    const h = harness({ kind: 'skewed', serverDeploymentId: 'new' });
    expect(offerToSkewRecovery(INCIDENT, h.deps)).toBe(true);
    await flush();
    expect(h.reload).toHaveBeenCalledTimes(1);
    expect(h.outcomes).toEqual(['reloaded-for-skew']);
  });

  test('same ⇒ ΚΑΜΙΑ ανανέωση (stale cache ή δικό μας bug — μένει ορατό)', async () => {
    const h = harness({ kind: 'same' });
    offerToSkewRecovery(INCIDENT, h.deps);
    await flush();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(['failed-same-version']);
  });

  test('unknown (δίκτυο) ⇒ καμία ανανέωση', async () => {
    const h = harness({ kind: 'unknown' });
    offerToSkewRecovery(INCIDENT, h.deps);
    await flush();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(['failed-network']);
  });

  test('skewed + μη αποθηκευμένη δουλειά ⇒ banner, όχι ανανέωση', async () => {
    const h = harness({ kind: 'skewed', serverDeploymentId: 'new' }, { hasUnsavedWork: () => true });
    offerToSkewRecovery(INCIDENT, h.deps);
    await flush();
    expect(h.reload).not.toHaveBeenCalled();
    expect(h.announceUpdate).toHaveBeenCalledWith('new');
    expect(h.outcomes).toEqual(['deferred-unsaved']);
  });

  test('δύο αναφορές του ίδιου σφάλματος (window + boundary) ⇒ ΜΙΑ ανανέωση', async () => {
    const h = harness({ kind: 'skewed', serverDeploymentId: 'new' });
    offerToSkewRecovery(INCIDENT, h.deps);
    offerToSkewRecovery(INCIDENT, h.deps);
    await flush();
    expect(h.reload).toHaveBeenCalledTimes(1);
  });

  test('άσχετο σφάλμα ⇒ false, ούτε probe', () => {
    const probe = jest.fn();
    const h = harness({ kind: 'skewed', serverDeploymentId: 'new' }, { probe });
    expect(offerToSkewRecovery(new Error('boom'), h.deps)).toBe(false);
    expect(probe).not.toHaveBeenCalled();
  });
});
