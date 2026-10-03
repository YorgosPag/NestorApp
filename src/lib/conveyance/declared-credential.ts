/**
 * =============================================================================
 * Η ΔΗΛΩΣΗ ΙΔΙΟΤΗΤΑΣ — ένα σχήμα, δύο είσοδοι (ADR-901 Ε-4 · Φ3 · Φ4)
 * =============================================================================
 *
 * Ο επαγγελματίας δηλώνει τον αριθμό μητρώου του **στη στιγμή της αποδοχής**, από όποια διαδρομή κι αν έρθει:
 * - πρόσκληση με email (`/case-invite/[token]` → `api/engagement-invitations/redeem`)
 * - πρόταση σε υπάρχοντα λογαριασμό (`/cases` → «Αναλαμβάνω» → `api/engagements/[id]/respond`)
 *
 * 🔑 Ένα σχήμα σημαίνει ότι τα δύο σύνορα **δεν** μπορούν να αποκλίνουν σε μήκη ή κανονικοποίηση. Ο **ρόλος**
 *    διαλέγει μητρώο (`ROLE_REGISTRY_AUTHORITY`), ποτέ ο άνθρωπος.
 *
 * @module lib/conveyance/declared-credential
 */

import { z } from 'zod';

import { ROLE_REGISTRY_AUTHORITY, type DeclaredCredential, type Engagement } from '@/types/engagement';
import type { CredentialHint } from '@/types/engagement-invitation';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Ε-4: **δήλωση**, όχι επαλήθευση. Ο αριθμός είναι υποχρεωτικός, ο σύλλογος/περιφέρεια προαιρετικός. Τα μήκη είναι φραγμένα. */
export const CREDENTIAL_DECLARATION_SCHEMA = z.object({
  number: z.string().trim().min(1).max(40),
  chapter: z.string().trim().max(120).nullable().optional().transform((v) => (v ? v : null)),
});

/** Η δήλωση όπως την πληκτρολόγησε ο επαγγελματίας. */
export type CredentialDeclarationInput = z.infer<typeof CREDENTIAL_DECLARATION_SCHEMA>;

/** Η απάντηση σε πρόταση συμμετοχής — η αποδοχή **φέρει** τη δήλωση, η άρνηση όχι (client **και** server). */
export type CaseEngagementAnswer =
  | { readonly decision: 'accept'; readonly credential: CredentialDeclarationInput }
  | { readonly decision: 'decline' };

/** Η αποθηκευμένη μορφή — **πάντα** `declared`, με το μητρώο του ρόλου. */
export function declaredCredentialOf(role: LegalProfessionalRole, input: CredentialDeclarationInput, declaredAt: string): DeclaredCredential {
  return { authority: ROLE_REGISTRY_AUTHORITY[role], number: input.number, chapter: input.chapter, assurance: 'declared', declaredAt };
}

/**
 * **«Θυμήσου με»** — η πιο πρόσφατη δήλωση **του ίδιου** ανθρώπου για το **ίδιο** μητρώο, σε οποιαδήποτε υπόθεσή
 * του. Η προσυμπλήρωση έρχεται πρώτα από τον ίδιο, και μόνο ως εφεδρεία από το βιβλίο του οικοδεσπότη. Είναι
 * ακριβέστερη (την πληκτρολόγησε ο ίδιος) και δεν διαρρέει τίποτα (είναι δικά του δεδομένα).
 */
export function latestOwnDeclaration(
  history: readonly Pick<Engagement, 'role' | 'declaredCredential'>[],
  role: LegalProfessionalRole,
): CredentialHint | null {
  const authority = ROLE_REGISTRY_AUTHORITY[role];
  const latest = history
    .map((engagement) => engagement.declaredCredential)
    .filter((credential): credential is DeclaredCredential => credential?.authority === authority)
    .sort((a, b) => b.declaredAt.localeCompare(a.declaredAt))[0];
  return latest ? { number: latest.number, chapter: latest.chapter } : null;
}
