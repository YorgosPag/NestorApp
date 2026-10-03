/**
 * =============================================================================
 * Transmittal υπόθεσης μεταβίβασης (ADR-901 §5.8.1 · Φ4.4)
 * =============================================================================
 *
 * Η πράξη *«στέλνω ΑΥΤΗ την έκδοση του δικού μου αρχείου στην υπόθεση, για ΑΥΤΗ τη γραμμή»* — το Transmittal
 * του Aconex / Autodesk Construction Cloud. Το αρχείο **μένει** στον προσωπικό χώρο του συντάκτη
 * (`files_personal`)· το έγγραφο αυτό καρφώνει **ποια έκδοση** (το `fileId` είναι η έκδοση — αλυσίδα διαδοχής,
 * `services/iso19650/version-stack.ts`) και **από ποιον ρόλο**.
 *
 * - **Αμετάβλητο**: νέα έκδοση ⇒ **νέο** έγγραφο με `supersedes`. Το μόνο που αλλάζει ποτέ είναι η απόσυρση
 *   (`withdrawnAt` · `withdrawnBy`), από τον **ΕΝΑ** γραφέα (`conveyance-contribution.service.ts`).
 * - **Χωρίς ακροατήριο στο έγγραφο**: το ορίζει ο **ρόλος** (`lib/conveyance/contribution-audience.ts`) —
 *   ό,τι παράγεται δεν αποθηκεύεται, άρα δεν μπορεί να αποκλίνει.
 * - `companyId` = ο **οικοδεσπότης** της υπόθεσης (μισθωτής του εγγράφου, CHECK 3.35).
 *
 * @module types/conveyance-contribution
 */

import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Η καρφωμένη έκδοση — αντίγραφο της στιγμής της αποστολής (ό,τι έλαβε ο άλλος, αποδείξιμα). */
export interface ContributionFile {
  readonly fileId: string;
  /** `fileId:revision:updatedAt` τη στιγμή της αποστολής (`fileFingerprint`). */
  readonly fingerprint: string;
  readonly displayName: string;
  readonly contentType: string;
}

export interface ConveyanceContribution {
  readonly id: string;
  /** Ο μισθωτής-οικοδεσπότης της υπόθεσης. */
  readonly companyId: string;
  readonly caseId: string;
  readonly projectId: string | null;
  readonly authorUid: string;
  readonly authorRole: LegalProfessionalRole;
  /** Η συμμετοχή μέσω της οποίας στάλθηκε — το ίχνος δείχνει **ποια** ανάθεση το έκανε. */
  readonly authorEngagementId: string;
  readonly checklistItemId: string;
  readonly entryPointId: string;
  readonly file: ContributionFile;
  /** Η προηγούμενη αποστολή του ίδιου συντάκτη για την ίδια γραμμή που αυτή διαδέχεται. */
  readonly supersedes: string | null;
  readonly issuedAt: string;
  readonly withdrawnAt: string | null;
  readonly withdrawnBy: string | null;
}

/** Η όψη που φτάνει στον client — ρητά πεδία, **χωρίς** uid συντάκτη (Α18). */
export interface ContributionSummary {
  readonly id: string;
  readonly checklistItemId: string;
  readonly authorRole: LegalProfessionalRole;
  readonly fileId: string;
  readonly displayName: string;
  readonly issuedAt: string;
  /** Είναι δική μου; (μόνο τότε προσφέρεται «Απόσυρση»). */
  readonly own: boolean;
}
