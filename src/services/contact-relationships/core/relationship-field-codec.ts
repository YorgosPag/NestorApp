// ============================================================================
// RELATIONSHIP FIELD CODEC — stored record ⇄ structured values (ADR-372 §8.6) · SSoT
// ============================================================================
//
// ONE place that answers «what does this stored relationship field MEAN?» for every
// writer (form, CRUD) and reader (edit form). Pure — no React, no I/O.
//
// 🔴 Why it exists (measured live, 2026-11-21, rel_2646…): a record kept its phone
// ONLY as a display string (`contactInfo.businessPhone: "+30 2310686440 (13)"`) and
// its start day as an invented instant (`"2026-11-21T11:38:14.504Z"`, from
// `startDate || nowISO()`). Opening + saving it, unchanged, would have written
// «+30 +30 2310686440 (13)» and wiped the day — a round trip that destroyed data.
//
// Industry practice (HubSpot / Salesforce): channels are STRUCTURED, the display
// string is a PROJECTION, and an empty date means «unknown», never «now».
// ============================================================================

import type { EmailInfo, PhoneInfo } from '@/types/contacts';
import type { ContactRelationship, ProfessionalContactInfo } from '@/types/contacts/relationships';
import { normalizeCalendarDay, normalizeToDate } from '@/lib/date-local';
import { calendarDayOf } from '@/constants/platform-operator';
import { formatPhoneDisplay, parsePhoneDisplay } from '@/utils/contacts/formatPhoneDisplay';
import { contactOwnerKindOf } from '@/lib/contact/contact-owner-kind';

/**
 * A relationship day (`startDate` / `endDate`) as `YYYY-MM-DD`, or `null` = unknown.
 * Accepts a calendar day, and — for legacy records — an instant, read as the day it
 * named in the operator's time zone (what the card already showed). Never invents one.
 */
export function relationshipCalendarDay(raw: unknown): string | null {
  const day = normalizeCalendarDay(raw);
  if (day) return day;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const instant = normalizeToDate(raw);
  return instant ? calendarDayOf(instant) : null;
}

/** Today, as the operator's calendar day — for writers that legitimately mean «today». */
export function todayRelationshipDay(): string {
  return calendarDayOf(new Date());
}

/** An update's days, normalized; fields the update does not carry stay absent. */
export function normalizeUpdateDays(updates: Partial<ContactRelationship>): Partial<ContactRelationship> {
  const normalized: Partial<ContactRelationship> = { ...updates };
  if ('startDate' in updates) normalized.startDate = relationshipCalendarDay(updates.startDate);
  if ('endDate' in updates) normalized.endDate = relationshipCalendarDay(updates.endDate);
  return normalized;
}

/**
 * **Whose channels are these?** — the side whose contact type decides which phone/e-mail
 * types a relationship offers, and whose channels «Copy from contact» reads (ADR-372 §8.5 b1). The channels belong to the ROLE HOLDER, not to the
 * card the form happens to be opened on (Google People: a «work phone» is the PERSON's line;
 * Salesforce `AccountContactRelation` keeps none of the account's channels):
 * - exactly one person ⇒ that person (the employee's / shareholder's own lines);
 * - otherwise (person ↔ person, organisation ↔ organisation) ⇒ the stored SOURCE.
 */
export function relationshipChannelOwnerSide(sourceType: unknown, targetType: unknown): 'source' | 'target' {
  const sourceIsPerson = contactOwnerKindOf(sourceType) === 'individual';
  const targetIsPerson = contactOwnerKindOf(targetType) === 'individual';
  return targetIsPerson && !sourceIsPerson ? 'target' : 'source';
}

type ChannelSource =Pick<ContactRelationship, 'phones' | 'emails' | 'contactInfo'>;

/** Structured phones of a stored record; legacy records are read from the display string. */
export function relationshipPhonesOf(rel: ChannelSource): PhoneInfo[] {
  if (rel.phones?.length) return rel.phones.map((phone) => ({ ...phone }));
  const parsed = parsePhoneDisplay(rel.contactInfo?.businessPhone);
  return parsed ? [{ ...parsed, type: 'work', isPrimary: true, label: '' }] : [];
}

/** Structured e-mails of a stored record; legacy records are read from `businessEmail`. */
export function relationshipEmailsOf(rel: ChannelSource): EmailInfo[] {
  if (rel.emails?.length) return rel.emails.map((email) => ({ ...email }));
  const email = rel.contactInfo?.businessEmail?.trim();
  return email ? [{ email, type: 'work', isPrimary: true, label: '' }] : [];
}

/** Drops rows the user left empty — an empty row is not a channel. */
export function compactChannels(phones: readonly PhoneInfo[], emails: readonly EmailInfo[]): {
  phones: PhoneInfo[];
  emails: EmailInfo[];
} {
  return {
    phones: phones.filter((phone) => phone.number?.trim()),
    emails: emails.filter((email) => email.email?.trim()),
  };
}

/**
 * The flat `contactInfo` PROJECTION of the structured channels (read by cards,
 * search, org chart). Other `contactInfo` fields are preserved; `null` when empty.
 */
export function projectContactInfo(
  base: Partial<ProfessionalContactInfo> | null | undefined,
  phones: readonly PhoneInfo[],
  emails: readonly EmailInfo[],
): ProfessionalContactInfo | null {
  const primaryPhone = phones.find((phone) => phone.isPrimary) ?? phones[0];
  const primaryEmail = emails.find((email) => email.isPrimary) ?? emails[0];
  const projected: ProfessionalContactInfo = {
    ...(base ?? {}),
    businessPhone: primaryPhone ? formatPhoneDisplay(primaryPhone) : undefined,
    businessEmail: primaryEmail?.email || undefined,
  };
  const hasAny = Object.values(projected).some((value) => value !== undefined && value !== null && value !== '');
  return hasAny ? stripUndefined(projected) : null;
}

/**
 * Fields whose **absence has a declared meaning** (protobuf proto3 «implicit presence»: an
 * unset `bool` IS `false`). A record written before the field existed means the same as one
 * that stores the default — the edit form materialises `false`, the store says nothing.
 */
const RELATIONSHIP_FIELD_DEFAULTS: Readonly<Record<string, unknown>> = { isWorkplace: false };

/**
 * **What does this field of a relationship MEAN?** — the value change detection compares
 * (Salesforce Field History compares values, not spellings). Same codec as the edit form:
 * - `phones` / `emails` → the structured channels, legacy display strings included;
 * - `contactInfo` → the projection of those channels (it is derived, so it is compared derived);
 * - `startDate` / `endDate` → the calendar day (`relationshipCalendarDay`), never the spelling;
 * - a field with a declared default → that default when absent.
 */
export function relationshipFieldMeaning(record: Partial<ContactRelationship>, field: string): unknown {
  if (field === 'phones') return relationshipPhonesOf(record);
  if (field === 'emails') return relationshipEmailsOf(record);
  if (field === 'contactInfo') {
    return projectContactInfo(record.contactInfo, relationshipPhonesOf(record), relationshipEmailsOf(record));
  }
  // A day is a day: a stored instant (`2026-11-21T11:36:52.119Z`) means the same calendar day
  // the form shows (`2026-11-21`) — measured live 2026-11-22 on rel_2d0d7053 (ADR-372 §8.6).
  if (field === 'startDate' || field === 'endDate') return relationshipCalendarDay(record[field]);
  const value: unknown = (record as Readonly<Record<string, unknown>>)[field];
  return value ?? RELATIONSHIP_FIELD_DEFAULTS[field];
}

/** Firestore rejects `undefined`; a projection must not carry it. */
function stripUndefined(info: ProfessionalContactInfo): ProfessionalContactInfo {
  return Object.fromEntries(
    Object.entries(info).filter(([, value]) => value !== undefined),
  ) as ProfessionalContactInfo;
}
