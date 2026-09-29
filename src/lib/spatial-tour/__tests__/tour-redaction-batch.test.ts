/**
 * @fileoverview **Η ΔΕΣΜΗ ΘΟΛΩΜΑΤΟΣ** (ADR-884 Φ2ζ ζ3 · §4.15) — το «Apply» της Matterport, με τους ΙΔΙΟΥΣ κριτές.
 *
 * - **Α** — `applyRedactionEdits`: ατομική, με τη σειρά, `unchanged` χωρίς πραγματική αλλαγή.
 * - **Δ** — `redactionEditsBetween`: αφαιρέσεις → αλλαγές → νέες, ντετερμινιστικά· εφαρμοσμένη στο «πριν» δίνει το «μετά».
 * - **Ν** — αναίρεση δέσμης: **μία** εντολή, και «αναίρεση της αναίρεσης» = το αρχικό σύνολο.
 */

import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { TourRedaction, TourRedactionRegion } from '@/types/spatial-tour';

import type { TourGraphCommand, TourRedactionEdit } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import { UNSTAMPED } from '../tour-plan-edit';
import { applyRedactionEdits, redactionEditsBetween, redactionEditsOf } from '../tour-redaction-edit';

const STAMP = { uid: 'boris', at: '2026-09-29T10:00:00.000Z' };
const [R1, R2, R3] = [0, 1, 2].map(() => enterpriseIdService.generateTourRedactionId()).sort();
const A: TourRedactionRegion = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
const B: TourRedactionRegion = { yawRad: -1, pitchRad: -0.3, radiusRad: 0.1 };

const redaction = (id: string, region: TourRedactionRegion): TourRedaction =>
  ({ id, ...region, source: 'manual', createdBy: 'x', createdAt: '2026-09-28T10:00:00.000Z' });
const geometry = (rs: readonly TourRedaction[]) => rs.map(({ id, yawRad, pitchRad, radiusRad }) => ({ id, yawRad, pitchRad, radiusRad }));

describe('Α — applyRedactionEdits', () => {
  it('εφαρμόζει με τη σειρά: νέα + αλλαγή + αφαίρεση', () => {
    const result = applyRedactionEdits([redaction(R1, A), redaction(R2, A)], [
      { op: 'redact', redactionId: R3, mode: 'create', region: B },
      { op: 'redact', redactionId: R1, mode: 'replace', region: B },
      { op: 'unredact', redactionId: R2 },
    ], STAMP);
    expect(result.kind).toBe('edited');
    expect(result.kind === 'edited' && geometry(result.redactions)).toEqual([{ id: R1, ...B }, { id: R3, ...B }]);
  });

  it('ΑΤΟΜΙΚΗ: η άρνηση ενός βήματος αρνείται ΟΛΗ τη δέσμη με τον λόγο του', () => {
    expect(applyRedactionEdits([], [
      { op: 'redact', redactionId: R1, mode: 'create', region: A },
      { op: 'redact', redactionId: R2, mode: 'create', region: { ...B, pitchRad: 3 } },
    ], STAMP)).toEqual({ kind: 'refused', reason: 'redaction-invalid' });
  });

  it('καμία πραγματική αλλαγή ⇒ unchanged (κενή δέσμη · αφαίρεση ανύπαρκτου · ίδια γεωμετρία)', () => {
    const current = [redaction(R1, A)];
    expect(applyRedactionEdits(current, [], STAMP)).toEqual({ kind: 'unchanged' });
    expect(applyRedactionEdits(current, [{ op: 'unredact', redactionId: R2 }], STAMP)).toEqual({ kind: 'unchanged' });
    expect(applyRedactionEdits(current, [{ op: 'redact', redactionId: R1, mode: 'replace', region: A }], STAMP)).toEqual({ kind: 'unchanged' });
  });

  it('η μονή εντολή είναι δέσμη ενός (ΕΝΑΣ δρόμος στον γραφέα)', () => {
    const redact: TourGraphCommand = { op: 'redact', captureId: 'c', redactionId: R1, mode: 'create', region: A };
    expect(redactionEditsOf(redact)).toEqual([{ op: 'redact', redactionId: R1, mode: 'create', region: A }]);
    expect(redactionEditsOf({ op: 'unredact', captureId: 'c', redactionId: R1 })).toEqual([{ op: 'unredact', redactionId: R1 }]);
  });
});

describe('Δ — redactionEditsBetween', () => {
  const before = [redaction(R1, A), redaction(R2, A)];
  const after = [{ id: R3, ...B }, { id: R1, ...B }];

  it('αφαιρέσεις πρώτα (ελευθερώνουν το όριο), μετά αλλαγές, μετά νέες', () => {
    expect(redactionEditsBetween(before, after)).toEqual<TourRedactionEdit[]>([
      { op: 'unredact', redactionId: R2 },
      { op: 'redact', redactionId: R1, mode: 'replace', region: B },
      { op: 'redact', redactionId: R3, mode: 'create', region: B },
    ]);
  });

  it('εφαρμοσμένη στο «πριν» δίνει ΑΚΡΙΒΩΣ το «μετά» · ίδια σύνολα ⇒ κενή', () => {
    const result = applyRedactionEdits(before, redactionEditsBetween(before, after), STAMP);
    expect(result.kind === 'edited' && geometry(result.redactions).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([...after].sort((a, b) => a.id.localeCompare(b.id)));
    expect(redactionEditsBetween(before, before)).toEqual([]);
  });

  it('ανεξάρτητη από τη σειρά εισόδου', () => {
    expect(redactionEditsBetween([...before].reverse(), [...after].reverse())).toEqual(redactionEditsBetween(before, after));
  });
});

describe('Ν — αναίρεση δέσμης', () => {
  const before = [redaction(R1, A), redaction(R2, A)];
  const command: TourGraphCommand = {
    op: 'redactions', captureId: 'c', edits: [
      { op: 'unredact', redactionId: R2 },
      { op: 'redact', redactionId: R3, mode: 'create', region: B },
    ],
  };

  it('ΜΙΑ εντολή δέσμης που γυρίζει στο «πριν»', () => {
    const undo = inverseOf(command, { nodes: [] }, { redactionsOf: () => before });
    expect(undo).toHaveLength(1);
    const edits = undo?.[0]?.op === 'redactions' ? undo[0].edits : [];
    const after = applyRedactionEdits(before, command.edits, UNSTAMPED);
    const back = after.kind === 'edited' ? applyRedactionEdits(after.redactions, edits, UNSTAMPED) : after;
    expect(back.kind === 'edited' && geometry(back.redactions).sort((a, b) => a.id.localeCompare(b.id))).toEqual(geometry(before));
  });

  it('χωρίς το «πριν» ή με δέσμη που δεν αλλάζει/αρνείται ⇒ καμία αναίρεση', () => {
    expect(inverseOf(command, { nodes: [] })).toBeNull();
    expect(inverseOf({ op: 'redactions', captureId: 'c', edits: [{ op: 'unredact', redactionId: R3 }] }, { nodes: [] }, { redactionsOf: () => before })).toBeNull();
    expect(inverseOf({ op: 'redactions', captureId: 'c', edits: [{ op: 'redact', redactionId: R3, mode: 'replace', region: B }] },
      { nodes: [] }, { redactionsOf: () => before })).toBeNull();
  });
});
