import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  type ContactIdentityAffectedDomainId,
  type ContactIdentityImpactDependency,
  type ContactIdentityImpactPreview,
} from '@/types/contact-identity-impact';
import type {
  IndividualIdentityField,
  IndividualIdentityFieldChange,
} from '@/utils/contactForm/individual-identity-guard';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ContactIdentityImpactPreview');

const DISPLAY_FIELDS: ReadonlySet<IndividualIdentityField> = new Set(['firstName', 'lastName']);
const IDENTITY_FIELDS: ReadonlySet<IndividualIdentityField> = new Set([
  'fatherName',
  'motherName',
  'birthDate',
  'birthCountry',
  'gender',
]);
const REGULATED_FIELDS: ReadonlySet<IndividualIdentityField> = new Set([
  'amka',
  'documentType',
  'documentIssuer',
  'documentNumber',
  'documentIssueDate',
  'documentExpiryDate',
]);

function hasAnyField(
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
  fields: ReadonlySet<IndividualIdentityField>,
): boolean {
  return changes.some((change) => fields.has(change.field));
}

function buildAffectedDomains(
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
): ReadonlyArray<ContactIdentityAffectedDomainId> {
  const domains = new Set<ContactIdentityAffectedDomainId>();

  if (hasAnyField(changes, DISPLAY_FIELDS)) {
    domains.add('linkedProjects');
    domains.add('searchAndReporting');
  }

  if (hasAnyField(changes, IDENTITY_FIELDS)) {
    domains.add('searchAndReporting');
  }

  if (changes.some((change) => change.field === 'amka')) {
    domains.add('ikaAttendance');
    domains.add('employmentCompliance');
  }

  if (hasAnyField(changes, REGULATED_FIELDS)) {
    domains.add('documentsAndIdentifiers');
  }

  return [...domains];
}

export async function previewContactIdentityImpact(
  contactId: string,
  changes: ReadonlyArray<IndividualIdentityFieldChange>,
): Promise<ContactIdentityImpactPreview> {
  const db = getAdminFirestore();
  const hasAmkaChange = changes.some((change) => change.field === 'amka');
  const hasOtherSensitiveChange = hasAnyField(changes, IDENTITY_FIELDS) || hasAnyField(changes, REGULATED_FIELDS);

  if (changes.length === 0) {
    return {
      mode: 'allow',
      changes,
      dependencies: [],
      affectedDomains: [],
      messageKey: 'identityImpact.messages.allow',
      blockingCount: 0,
      warningCount: 0,
    };
  }

  try {
    const [projectLinksSnapshot, attendanceEventsSnapshot, employmentRecordsSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.CONTACT_LINKS)
        .where('sourceContactId', '==', contactId)
        .where('targetEntityType', '==', 'project')
        .where('status', '==', 'active')
        .select()
        .get(),
      db.collection(COLLECTIONS.ATTENDANCE_EVENTS)
        .where('contactId', '==', contactId)
        .select()
        .get(),
      db.collection(COLLECTIONS.EMPLOYMENT_RECORDS)
        .where('contactId', '==', contactId)
        .select()
        .get(),
    ]);

    const dependencies: ContactIdentityImpactDependency[] = [];
    const projectLinks = projectLinksSnapshot.size;
    const attendanceEvents = attendanceEventsSnapshot.size;
    const employmentRecords = employmentRecordsSnapshot.size;

    if (projectLinks > 0) {
      dependencies.push({
        id: 'projectLinks',
        count: projectLinks,
        mode: 'warn',
      });
    }

    if (attendanceEvents > 0 && (hasAmkaChange || hasOtherSensitiveChange)) {
      dependencies.push({
        id: 'attendanceEvents',
        count: attendanceEvents,
        mode: hasAmkaChange ? 'block' : 'warn',
      });
    }

    if (employmentRecords > 0 && (hasAmkaChange || hasOtherSensitiveChange)) {
      dependencies.push({
        id: 'employmentRecords',
        count: employmentRecords,
        mode: hasAmkaChange ? 'block' : 'warn',
      });
    }

    const blockingCount = dependencies
      .filter((dependency) => dependency.mode === 'block')
      .reduce((sum, dependency) => sum + dependency.count, 0);
    const warningCount = dependencies
      .filter((dependency) => dependency.mode === 'warn')
      .reduce((sum, dependency) => sum + dependency.count, 0);

    const affectedDomains = buildAffectedDomains(changes);

    let mode: ContactIdentityImpactPreview['mode'] = 'allow';
    if (blockingCount > 0) {
      mode = 'block';
    } else if (warningCount > 0 || affectedDomains.length > 0) {
      mode = 'warn';
    }

    return {
      mode,
      changes,
      dependencies,
      affectedDomains,
      messageKey: `identityImpact.messages.${mode}`,
      blockingCount,
      warningCount,
    };
  } catch (error) {
    logger.warn('Contact identity impact preview failed', error);
    return {
      mode: 'block',
      changes,
      dependencies: [],
      affectedDomains: buildAffectedDomains(changes),
      messageKey: 'identityImpact.messages.unavailable',
      blockingCount: 0,
      warningCount: 0,
    };
  }
}
