/**
 * @jest-environment node
 *
 * @fileoverview **ΠΟΙΟΣ ΚΑΘΕΤΑΙ ΣΤΗΝ ΟΜΑΔΑ** — ADR-867 Β9(β) Ε1β, πάνω στον **πραγματικό** κατάλογο ρόλων.
 *
 * ⚠️ Κανένα mock του καταλόγου: το ερώτημα είναι ακριβώς *«τι λέει ο κατάλογος;»*. Αν κάποιος
 * αφαιρέσει την ικανότητα από ρόλο προσωπικού (ή τη δώσει σε επισκέπτη), κοκκινίζει εδώ.
 */

import { GLOBAL_ROLES } from '@/lib/auth/types';
import { ACT_TEAM_SEAT_CAPABILITY, canServeOnActTeam } from '../act-team-eligibility';

const NOT_STAFF = ['external_user', 'vendor', 'viewer'] as const;

describe('Ε1β — «υπάρχει στο γραφείο» ≠ «μιλά για το γραφείο»', () => {
  it('Ε1β.0 — η ικανότητα είναι γνωστή στον κριτή (αλλιώς θα αρνιόταν σε ΟΛΟΥΣ — ψεύτικο πράσινο στο Ε1β.2)', () => {
    expect(canServeOnActTeam('company_admin')).toBe(true);
    expect(ACT_TEAM_SEAT_CAPABILITY).toBe('network:threads:respond');
  });

  it.each(NOT_STAFF)('🔴 Ε1β.1 — ο «%s» ΔΕΝ αναλαμβάνει (Zendesk light agent · Slack guest)', (role) => {
    expect(canServeOnActTeam(role)).toBe(false);
  });

  it('Ε1β.2 — κάθε ΑΛΛΟΣ καθολικός ρόλος (ο ρόλος της θέσης) αναλαμβάνει — νέος ρόλος χωρίς απόφαση κοκκινίζει εδώ', () => {
    const staff = GLOBAL_ROLES.filter((role) => !(NOT_STAFF as readonly string[]).includes(role));
    expect(staff.length).toBeGreaterThan(0);
    for (const role of staff) expect([role, canServeOnActTeam(role)]).toEqual([role, true]);
  });

  it('Ε1β.3 — χωρίς ρόλο (`null` / `\'\'`) ⇒ όχι (fail-closed)', () => {
    expect(canServeOnActTeam(null)).toBe(false);
    expect(canServeOnActTeam('')).toBe(false);
  });
});
