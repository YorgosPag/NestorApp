/**
 * ΑΓΚΥΡΑ — ADR-812: ΕΝΑ λεξιλόγιο κατάστασης έργου, ΕΝΑ σπίτι.
 *
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ (μετρημένο 2026-08-26 με AST σε 15.344 αρχεία): το ADR-287
 * δήλωσε SSoT «ProjectStatus» και υπήρχαν **δεκατρία** σώματα με **τέσσερα
 * ασύμβατα σύνολα τιμών** — και δύο ομώνυμα `PROJECT_STATUSES`.
 *
 * 🏆 Ο ΔΙΑΧΩΡΙΣΜΟΣ ΤΩΝ ΑΞΟΝΩΝ: τα `review`/`approved` ΔΕΝ είναι καταστάσεις
 * έργου — είναι καταστάσεις ΕΓΚΡΙΣΗΣ ΠΑΡΑΔΟΤΕΟΥ, και οι τρεις μεγάλοι τις
 * κρατούν σε άλλο αντικείμενο: ISO 19650 (`S3` suitable for review and comment,
 * `S4` suitable for stage approval, `B1` shared for authorisation → information
 * container) · Revit (`Issued` → revision, `Approved By` → sheet) · Figma
 * («Approved» → branch). Ένα έργο πρέπει να μπορεί να είναι «σε εξέλιξη» ΚΑΙ να
 * έχει εγκεκριμένη άδεια ταυτόχρονα.
 *
 * ⚠️ ΑΥΤΟ ΤΟ TEST ΕΚΤΕΛΕΙ ΤΑ ΣΩΜΑΤΑ, δεν διαβάζει κείμενο. Ο τύπος
 * `Record<ProjectStatus, …>` είναι ήδη φρουρός — αλλά ο N.17 απαγορεύει `tsc`
 * στον πράκτορα, οπότε η ταύτιση επαληθεύεται εδώ σε χρόνο εκτέλεσης.
 */
import {
  PROJECT_STATUSES,
  ACTIVE_PROJECT_STATUSES,
  IN_PROGRESS_PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  isProjectStatus,
} from '../project-statuses';
import { createProjectStatuses } from '@/core/status/StatusConstants';
import { getProjectStatusLabels } from '@/config/vocabulary/labels/status';
import { getFieldOptions } from '@/core/modals/smart-dialog-config';
import { PROJECT_STATUS_LABELS as REEXPORTED } from '@/types/project';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { UseSemanticColorsReturn } from '@/ui-adapters/react/useSemanticColors';

const colors = {
  text: COLOR_BRIDGE.text, bg: COLOR_BRIDGE.bg, border: COLOR_BRIDGE.border,
  interactive: COLOR_BRIDGE.interactive, gradients: COLOR_BRIDGE.gradients, ring: COLOR_BRIDGE.ring,
  getText: (t: never) => COLOR_BRIDGE.text[t], getBg: (t: never) => COLOR_BRIDGE.bg[t],
  getBorder: (t: never) => COLOR_BRIDGE.border[t], getGradient: (t: never) => COLOR_BRIDGE.gradients[t],
  getRing: (t: never) => COLOR_BRIDGE.ring[t],
} as unknown as UseSemanticColorsReturn;

/** Ο ΑΞΟΝΑΣ ΕΓΚΡΙΣΗΣ — ποτέ στο lifecycle του έργου. */
const APPROVAL_AXIS = ['review', 'approved'] as const;

describe('ADR-812 — ένα λεξιλόγιο, ένα σπίτι', () => {
  it('Κ0 ΠΑΡΟΝΟΜΑΣΤΗΣ — το SSoT δεν είναι κενό και έχει τις 6 κανονικές', () => {
    expect(PROJECT_STATUSES).toEqual(
      ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled', 'deleted']);
  });

  it('Κ1 — οι ετικέτες καλύπτουν ΑΚΡΙΒΩΣ το λεξιλόγιο, καμία λιγότερη, καμία παραπάνω', () => {
    expect(Object.keys(PROJECT_STATUS_LABELS).sort()).toEqual([...PROJECT_STATUSES].sort());
  });

  it('Κ2 — τα badge configs καλύπτουν ΑΚΡΙΒΩΣ το λεξιλόγιο', () => {
    expect(Object.keys(createProjectStatuses(colors)).sort()).toEqual([...PROJECT_STATUSES].sort());
  });

  it('Κ3 — ο getter του vocabulary ΕΠΙΣΤΡΕΦΕΙ το SSoT, δεν το αντιγράφει', () => {
    expect(getProjectStatusLabels()).toBe(PROJECT_STATUS_LABELS);
  });

  it('Κ4 — το types/project ΕΠΑΝΕΞΑΓΕΙ, δεν ορίζει δεύτερο πίνακα', () => {
    expect(REEXPORTED).toBe(PROJECT_STATUS_LABELS);
  });

  it('Κ5 — το dropdown παράγεται από το ΥΠΟΣΥΝΟΛΟ ΦΟΡΜΑΣ, όχι από τις ετικέτες', () => {
    const opts = getFieldOptions('status', 'project');
    expect(opts?.map(o => o.value)).toEqual([...ACTIVE_PROJECT_STATUSES]);
    // …και το soft-delete ΔΕΝ είναι επιλογή: είναι ενέργεια (ADR-028).
    expect(opts?.map(o => o.value)).not.toContain('deleted');
    // …ενώ κάθε επιλογή έχει ΠΡΑΓΜΑΤΙΚΗ ετικέτα (όχι undefined).
    expect(opts?.every(o => typeof o.label === 'string' && o.label.length > 0)).toBe(true);
  });

  it('Κ6 — Ο ΑΞΟΝΑΣ ΕΓΚΡΙΣΗΣ ΕΙΝΑΙ ΕΞΩ, από ΚΑΘΕ σώμα', () => {
    for (const v of APPROVAL_AXIS) {
      expect(isProjectStatus(v)).toBe(false);
      expect(PROJECT_STATUSES as readonly string[]).not.toContain(v);
      expect(Object.keys(PROJECT_STATUS_LABELS)).not.toContain(v);
      expect(Object.keys(createProjectStatuses(colors))).not.toContain(v);
      expect(getFieldOptions('status', 'project')?.map(o => o.value)).not.toContain(v);
    }
  });

  it('Κ7 — τα υποσύνολα είναι ΓΝΗΣΙΑ υποσύνολα του λεξιλογίου', () => {
    for (const sub of [ACTIVE_PROJECT_STATUSES, IN_PROGRESS_PROJECT_STATUSES]) {
      expect(sub.length).toBeGreaterThan(0);
      expect(sub.length).toBeLessThan(PROJECT_STATUSES.length);
      for (const v of sub) expect(isProjectStatus(v)).toBe(true);
    }
  });

  it('Κ8 — κάθε ετικέτα είναι i18n ΚΛΕΙΔΙ, ποτέ ωμό κείμενο (N.11)', () => {
    for (const [status, key] of Object.entries(PROJECT_STATUS_LABELS)) {
      expect(key).toMatch(/^[a-z][\w-]*[.:][\w.]+$/);
      expect(key).not.toMatch(/[Ͱ-Ͽ]/);   // κανένα ελληνικό γράμμα
      expect(key.startsWith('projects.status.')).toBe(true);
      expect(status.length).toBeGreaterThan(0);
    }
  });
});
