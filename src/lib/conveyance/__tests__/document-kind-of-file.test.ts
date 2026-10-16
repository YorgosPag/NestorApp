/**
 * ⚓ ADR-915 §20 — «τι έγγραφο είναι αυτό το αρχείο;» διαβάζεται ΑΝΑΠΟΔΑ από τον ΕΝΑ κατάλογο, ποτέ από δεύτερη λίστα.
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import { LEVEL_ENTITY_TYPES } from '@/lib/conveyance/evidence-match';
import { documentKindsOfFile } from '@/lib/conveyance/document-kind-of-file';

describe('documentKindsOfFile (ADR-915 §20)', () => {
  it('ενημερότητες του πωλητή (επαφή) ⇒ το είδος της γραμμής τους', () => {
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'tax-clearance' })).toEqual(['tax-clearance']);
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'insurance-clearance' })).toEqual(['insurance-clearance']);
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'owner-enfia' })).toEqual(['enfia-certificate']);
  });

  it('το ΙΔΙΟ σκοπός σε επίπεδο που η γραμμή δεν ακούει ⇒ τίποτα (το επίπεδο μετρά, όπως στον κατάλογο)', () => {
    expect(documentKindsOfFile({ entityType: 'project', purpose: 'tax-clearance' })).toEqual([]);
  });

  it('άγνωστος σκοπός · ελλιπή πεδία ⇒ τίποτα — ποτέ μαντεψιά', () => {
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'document' })).toEqual([]);
    expect(documentKindsOfFile({ entityType: 'contact' })).toEqual([]);
    expect(documentKindsOfFile({ entityType: 42, purpose: 'tax-clearance' })).toEqual([]);
  });

  // Άγκυρα ταυτότητας: για ΚΑΘΕ γραμμή με είδος, κάθε (entityType, purpose) που την ικανοποιεί δίνει πίσω το είδος της.
  it('round-trip σε όλο τον κατάλογο: κανένα entry point γραμμής-με-είδος δεν χάνεται', () => {
    let checked = 0;
    for (const item of CONVEYANCE_CHECKLIST) {
      if (item.documentKind === undefined || item.satisfaction.kind !== 'files') continue;
      for (const matcher of item.satisfaction.matchers) {
        for (const entityType of LEVEL_ENTITY_TYPES[matcher.level]) {
          for (const id of matcher.entryPointIds) {
            const entry = findEntryPoint(entityType, id);
            if (entry === undefined) continue;
            expect(documentKindsOfFile({ entityType, purpose: entry.purpose })).toContain(item.documentKind);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });
});
