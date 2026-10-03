/**
 * Conveyance — **ποιες συναινέσεις** χρειάζεται η πρόσβαση κάθε θέσης (ADR-901 §5.2 «δύο κλειδιά»).
 *
 * Ο οικοδεσπότης της Φ2 είναι ο **εργολάβος-πωλητής** (`new_build_company`). Πρακτική κλάδου (Qualia ·
 * dotloop): ο κάτοχος του φακέλου καλεί **όλα** τα μέρη. Εδώ, ό,τι αφορά τα έγγραφα της **άλλης** πλευράς
 * θέλει **δηλωμένη** συναίνεση με **βάση** — ποτέ σιωπηρή:
 *
 * | θέση | πλευρά πωλητή | πλευρά αγοραστή |
 * |---|---|---|
 * | `seller_lawyer` | ✅ δική του (`own_side`) | — |
 * | `buyer_lawyer`  | — | 📝 δήλωση οικοδεσπότη + βάση |
 * | `notary`        | ✅ δική του | 📝 δήλωση οικοδεσπότη + βάση (ADR-901 Ε-3: «Συμφωνώ» της άλλης πλευράς) |
 *
 * 🔮 Όταν ο αγοραστής έχει λογαριασμό (ADR-901 Φ5), η ίδια γραμμή γράφεται με `source: 'in_app'` — **ένα**
 *    σχήμα, δύο προελεύσεις.
 *
 * **Layering**: leaf — καθαρή.
 *
 * @module lib/conveyance/engagement-consent
 */

import type { ConsentBasis, EngagementConsent, EngagementSide } from '@/types/engagement';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Ποιες πλευρές «ανοίγει» κάθε θέση. */
const SIDES_BY_ROLE: Readonly<Record<LegalProfessionalRole, readonly EngagementSide[]>> = {
  seller_lawyer: ['seller'],
  buyer_lawyer: ['buyer'],
  notary: ['seller', 'buyer'],
};

/** Η πλευρά του οικοδεσπότη στη Φ2 — ο εργολάβος **πουλά**. */
const HOST_SIDE: EngagementSide = 'seller';

/** Βάσεις που επιτρέπεται να **δηλώσει** ο οικοδεσπότης για την άλλη πλευρά. */
export const ATTESTABLE_BASES = ['preliminary_contract', 'written_instruction', 'verbal_instruction'] as const satisfies readonly ConsentBasis[];

/** Χρειάζεται αυτή η θέση δηλωμένη συναίνεση της άλλης πλευράς; — για το UI (ένα ερώτημα, μία απάντηση). */
export function requiresAttestation(role: LegalProfessionalRole): boolean {
  return SIDES_BY_ROLE[role].some((side) => side !== HOST_SIDE);
}

export type ConsentPlan =
  | { readonly ok: true; readonly consents: readonly EngagementConsent[] }
  | { readonly ok: false; readonly rejection: 'consent-basis-required' };

/**
 * Οι συναινέσεις της πρότασης — ή άρνηση αν λείπει η βάση για την άλλη πλευρά.
 *
 * @param attestedBasis Η βάση που δήλωσε ο οικοδεσπότης (μόνο από το {@link ATTESTABLE_BASES}).
 */
export function planConsents(
  role: LegalProfessionalRole,
  attestedBasis: ConsentBasis | null,
  attestedBy: string,
  attestedAt: string,
): ConsentPlan {
  const consents: EngagementConsent[] = [];
  for (const side of SIDES_BY_ROLE[role]) {
    if (side === HOST_SIDE) {
      consents.push({ side, source: 'own_side', basis: 'own_side', attestedBy, attestedAt });
      continue;
    }
    if (attestedBasis === null || !(ATTESTABLE_BASES as readonly ConsentBasis[]).includes(attestedBasis)) {
      return { ok: false, rejection: 'consent-basis-required' };
    }
    consents.push({ side, source: 'host_attested', basis: attestedBasis, attestedBy, attestedAt });
  }
  return { ok: true, consents };
}
