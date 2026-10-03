/**
 * Το σχήμα του αποθηκευμένου εγγράφου πρόσκλησης υπόθεσης (ADR-901 Φ3) — **η μία μετάφραση** δίσκου → τύπου.
 *
 * Ό,τι δεν διαβάζεται ⇒ `null` ⇒ η μηχανή το λέει `invitation-corrupt` — **καμία** συμμετοχή δεν γεννιέται από
 * έγγραφο που δεν καταλάβαμε (ένας «μαντεμένος» ρόλος ή χώρος = πρόσβαση που κανείς δεν έδωσε, ADR-749).
 * Η κατάσταση ελέγχεται εδώ **αυστηρά**· τη fail-closed ανάγνωσή της για τις αρνήσεις την κάνει ο πυρήνας.
 *
 * Καθαρό — το καλούν έκδοση, όψη, εξαργύρωση, υπενθύμιση και άγκυρες.
 *
 * @module lib/conveyance/engagement-invitation-schema
 */

import { z } from 'zod';

import { engagementConsentSchema } from '@/lib/auth/engagement-schema';
import { normalizeToISO } from '@/lib/date-local';
import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import type { EngagementInvitation } from '@/types/engagement-invitation';
import { INVITATION_STATES } from '@/types/invitation-core';

const nonEmpty = z.string().min(1);
/** Στιγμή — δέχεται Timestamp/Date/ISO του δίσκου, δίνει **πάντα** ISO (ή αποτυγχάνει). */
const instant = z.unknown().transform((value, ctx) => {
  const iso = normalizeToISO(value);
  if (iso === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unreadable instant' });
  return iso ?? '';
});
const optionalInstant = z.unknown().transform((value, ctx) => {
  if (value === null || value === undefined) return null;
  const iso = normalizeToISO(value);
  if (iso === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unreadable instant' });
  return iso;
});

const engagementInvitationSchema = z.object({
  inviteeEmail: nonEmpty,
  invitedByUid: nonEmpty,
  nonceHash: nonEmpty,
  state: z.enum(INVITATION_STATES),
  createdAt: instant,
  expiresAt: instant,
  openedAt: optionalInstant,
  resolvedAt: optionalInstant,
  resolvedByUid: z.string().nullable().optional().transform((v) => v ?? null),
  mailboxProvenAt: optionalInstant,
  hostCompanyId: nonEmpty,
  projectId: nonEmpty,
  caseId: nonEmpty,
  propertyId: nonEmpty,
  role: z.enum(LEGAL_ENGAGEMENT_ROLES),
  contactId: nonEmpty,
  consents: z.array(engagementConsentSchema),
  credentialHint: z.object({ number: z.string().nullable(), chapter: z.string().nullable() }),
  reminderDueAt: instant,
  reminderSentAt: optionalInstant,
});

/** Ωμό έγγραφο → `EngagementInvitation`, ή `null` αν δεν είναι πρόσκληση που καταλαβαίνουμε. */
export function engagementInvitationFromDocument(raw: unknown, id: string): EngagementInvitation | null {
  const parsed = engagementInvitationSchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, id } : null;
}
