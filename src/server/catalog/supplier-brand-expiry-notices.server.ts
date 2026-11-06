import 'server-only';

/**
 * @fileoverview **Η ΜΑΡΚΑ ΣΑΣ ΛΗΓΕΙ** (ADR-923 §16, κενό «καμία ειδοποίηση πριν από τη λήξη»).
 * @related subapps/catalog/public/supplier-brand-expiry.ts (η κρίση) · server/catalog/supplier-brand-claim.server.ts (ο γραφέας)
 * @module server/catalog/supplier-brand-expiry-notices.server
 *
 * 🔑 **Η λήξη μένει παραγόμενη** (§16): η σάρωση δεν «λήγει» τίποτα, μόνο λέει. Η μάρκα πέφτει από τη δημόσια σελίδα
 *    μόνη της, όπως πριν.
 * 🔑 **Ακριβώς μία φορά ανά σκαλί, χωρίς χαμένο μήνυμα**: πρώτα η ειδοποίηση (ντετερμινιστικό `eventId` με τη λήξη και το
 *    σκαλί ⇒ dedupe του orchestrator), **μετά** το CAS του `grant.expiryNotice`. Πτώση ανάμεσα ⇒ η επόμενη σάρωση την
 *    ξαναστέλνει και το dedupe την κόβει· ποτέ «σημειώθηκε αλλά δεν στάλθηκε». Αν **κανένας** διαχειριστής δεν την πήρε,
 *    δεν σημειώνεται, άρα ξαναδοκιμάζεται αύριο.
 * 🔑 **Σελιδοποιημένη, φραγμένη**: τα ήδη ειπωμένα μένουν στο παράθυρο ως τη λήξη, άρα ένα απλό `limit` θα τα ξανάβλεπε
 *    κάθε μέρα και θα έκρυβε τα υπόλοιπα. Δρομέας ανά σελίδα, και ανώτατο όριο σελίδων ανά πέρασμα (`truncated`).
 */

import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { getCurrentEnvironment, NOTIFICATION_ENTITY_TYPES, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { addDaysToDateKey, daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { todayLocalDate } from '@/lib/date-local';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { createModuleLogger } from '@/lib/telemetry';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { notificationFallbackTitle } from '@/server/notifications/notification-title';
import { CATALOG_PAGES } from '@/subapps/catalog/catalog-routes';
import {
  BRAND_EXPIRED_NOTICE_DAYS,
  BRAND_EXPIRY_NOTICE_HORIZON_DAYS,
  brandExpiryDateOf,
  brandExpiryNoticeDue,
} from '@/subapps/catalog/public/supplier-brand-expiry';
import type { BrandExpiryNoticeStage, SupplierBrandClaimRecord } from '@/subapps/catalog/types/supplier-brand-claim';
import { orgWorkspace } from '@/types/workspace-membership';

import { readBrandGrantsExpiringPage, recordBrandExpiryNotice } from './supplier-brand-claim.server';

const logger = createModuleLogger('SUPPLIER_BRAND_EXPIRY_NOTICES');

const PAGE_SIZE = 100;
/** Ανώτατο όριο σελίδων ανά πέρασμα: χωρά στο `maxRuntimeMinutes` του cron· το υπόλοιπο το παίρνει η επόμενη μέρα. */
const MAX_PAGES = 20;

export interface BrandExpirySweepReport {
  readonly considered: number;
  readonly notified: number;
  readonly skipped: number;
  readonly failed: number;
  readonly truncated: boolean;
}

interface BrandExpiryText {
  readonly titleKey: string;
  readonly titleParams: Readonly<Record<string, string>>;
  readonly bodyKey: string;
}

/** Το κείμενο ανά σκαλί. Ο αριθμός ημερών είναι ο **πραγματικός**, όχι το σκαλί: δικαίωμα με 20 ημέρες δεν λέει «30». */
export function brandExpiryText(record: Pick<SupplierBrandClaimRecord, 'brandName'>, stage: BrandExpiryNoticeStage, daysLeft: number): BrandExpiryText {
  const brand = record.brandName;
  if (stage === 'expired') return { titleKey: 'brandExpiry.expiredTitle', titleParams: { brand }, bodyKey: 'brandExpiry.expiredBody' };
  if (stage === 'd0') return { titleKey: 'brandExpiry.d0Title', titleParams: { brand }, bodyKey: 'brandExpiry.renewBody' };
  return { titleKey: 'brandExpiry.soonTitle', titleParams: { brand, days: String(daysLeft) }, bodyKey: 'brandExpiry.renewBody' };
}

/** Πού ανοίγει η ειδοποίηση: οι ρυθμίσεις καταλόγου του χώρου, όπου ζει η κατοχή μάρκας. Ο ίδιος προορισμός για τον ανιχνευτή. */
export const brandExpiryDestination = (companyId: string) => viewDestination(CATALOG_PAGES.settings, orgWorkspace(companyId));

async function notifyAdministrators(db: Firestore, record: SupplierBrandClaimRecord, stage: BrandExpiryNoticeStage, asOf: string): Promise<boolean> {
  const grant = record.grant;
  if (grant === null) return false;
  const administrators = await activeWorkspaceAdministrators(db, record.companyId);
  const text = brandExpiryText(record, stage, daysBetweenDateKeys(asOf, brandExpiryDateOf(grant)) ?? 0);
  const results = await Promise.allSettled(administrators.map((uid) => dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROCUREMENT_BRAND_GRANT_EXPIRING,
    recipientId: uid,
    tenantId: record.companyId,
    title: notificationFallbackTitle(text.titleKey, text.titleParams),
    titleKey: text.titleKey,
    titleParams: { ...text.titleParams },
    body: notificationFallbackTitle(text.bodyKey),
    bodyKey: text.bodyKey,
    eventId: `brand-expiry:${record.id}:${grant.validUntil}:${stage}`,
    entityId: record.id,
    entityType: NOTIFICATION_ENTITY_TYPES.SUPPLIER_BRAND_CLAIM,
    ...brandExpiryDestination(record.companyId),
    source: { service: SOURCE_SERVICES.PROCUREMENT, feature: 'brand-expiry', env: getCurrentEnvironment() },
  })));
  const delivered = results.filter((result) => result.status === 'fulfilled').length;
  if (delivered < results.length) logger.error('Ειδοποίηση λήξης μάρκας: αποτυχίες', { claimId: record.id, failed: results.length - delivered });
  return delivered > 0;
}

/** Το παράθυρο της ημέρας: από τις λήξεις που λέγονται ακόμη «έληξε» ως το πρώτο σκαλί (30 ημέρες). */
function sweepWindow(asOf: string): { readonly from: string; readonly until: string } | null {
  const first = addDaysToDateKey(asOf, -BRAND_EXPIRED_NOTICE_DAYS);
  const last = addDaysToDateKey(asOf, BRAND_EXPIRY_NOTICE_HORIZON_DAYS);
  return first === null || last === null ? null : { from: `${first}T00:00:00.000Z`, until: `${last}T23:59:59.999Z` };
}

type Outcome = 'notified' | 'skipped' | 'failed';

async function settleOne(db: Firestore, record: SupplierBrandClaimRecord, asOf: string): Promise<Outcome> {
  const stage = brandExpiryNoticeDue(record.grant, asOf);
  if (stage === null) return 'skipped';
  try {
    if (!(await notifyAdministrators(db, record, stage, asOf))) return 'failed';
    return (await recordBrandExpiryNotice(db, record.id, stage, asOf)) ? 'notified' : 'skipped';
  } catch (error: unknown) {
    logger.error('Η ειδοποίηση λήξης μάρκας απέτυχε', { claimId: record.id, error: error instanceof Error ? error.message : String(error) });
    return 'failed';
  }
}

/** **Ένα πέρασμα.** Κάθε κάδος εκπέμπεται και όταν είναι μηδέν: «0» ≠ «δεν κοίταξε κανείς». */
export async function sweepSupplierBrandExpiryNotices(db: Firestore, asOf: string = todayLocalDate()): Promise<BrandExpirySweepReport> {
  const window = sweepWindow(asOf);
  if (window === null) throw new Error(`brand expiry sweep: invalid asOf ${asOf}`);
  const counts: Record<Outcome, number> = { notified: 0, skipped: 0, failed: 0 };
  let considered = 0;
  let cursor: QueryDocumentSnapshot | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await readBrandGrantsExpiringPage(db, window, PAGE_SIZE, cursor);
    considered += result.records.length;
    for (const record of result.records) counts[await settleOne(db, record, asOf)] += 1;
    cursor = result.next;
    if (cursor === null) break;
  }
  return { considered, ...counts, truncated: cursor !== null };
}
