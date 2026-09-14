/**
 * ADR-841 §7 Α21.17 — ποιο κατάστημα ανεβαίνει στη γραμμή «Επικοινωνία» (και ΔΕΝ επαναλαμβάνεται στην κάρτα).
 */

import type { ShowcaseLocation } from '@/types/showcase-card';
import { primaryChannelLocation } from '../showcase-card-primary';

function location(id: string, overrides: Partial<ShowcaseLocation> = {}): ShowcaseLocation {
  return {
    id,
    role: 'branch',
    label: null,
    place: { landId: 'land_1', buildingId: null },
    position: null,
    street: null,
    hours: null,
    channelKinds: ['phone'],
    emailConfirmedAt: null,
    ...overrides,
  };
}

describe('primaryChannelLocation', () => {
  it('η ΕΔΡΑ κερδίζει όταν έχει κανάλι — ακόμη κι αν δεν είναι πρώτη στη λίστα', () => {
    const headquarters = location('sloc_hq', { role: 'headquarters' });
    expect(primaryChannelLocation([location('sloc_b'), headquarters])).toBe(headquarters);
  });

  it('🔑 έδρα ΧΩΡΙΣ κανάλι ⇒ το πρώτο υποκατάστημα που έχει', () => {
    const branch = location('sloc_b');
    expect(primaryChannelLocation([location('sloc_hq', { role: 'headquarters', channelKinds: [] }), branch])).toBe(branch);
  });

  it('κανένα κανάλι πουθενά ⇒ null (η γραμμή «Επικοινωνία» σιωπά)', () => {
    expect(primaryChannelLocation([location('sloc_b', { channelKinds: [] })])).toBeNull();
    expect(primaryChannelLocation([])).toBeNull();
  });
});
