import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type {
  ContactIdentityImpactDependency,
  ContactIdentityImpactPreview,
} from '@/types/contact-identity-impact';
import type { ServiceIdentityFieldChange } from '@/utils/contactForm/service-identity-guard';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ServiceIdentityImpactPreview');

export async function previewServiceIdentityImpact(
  contactId: string,
  changes: ReadonlyArray<ServiceIdentityFieldChange>,
): Promise<ContactIdentityImpactPreview> {
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

  const db = getAdminFirestore();

  try {
    const [projectLinksSnapshot, relationshipsSourceSnapshot, relationshipsTargetSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.CONTACT_LINKS)
        .where('sourceContactId', '==', contactId)
        .where('targetEntityType', '==', ENTITY_TYPES.PROJECT)
        .where('status', '==', 'active')
        .select()
        .get(),
      db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
        .where('sourceContactId', '==', contactId)
        .select()
        .get(),
      db.collection(COLLECTIONS.CONTACT_RELATIONSHIPS)
        .where('targetContactId', '==', contactId)
        .select()
        .get(),
    ]);

    const dependencies: ContactIdentityImpactDependency[] = [];
    const projectLinks = projectLinksSnapshot.size;
    const contactRelationships = relationshipsSourceSnapshot.size + relationshipsTargetSnapshot.size;

    if (projectLinks > 0) {
      dependencies.push({ id: 'projectLinks', count: projectLinks, mode: 'warn' });
    }

    if (contactRelationships > 0) {
      dependencies.push({ id: 'contactRelationships', count: contactRelationships, mode: 'warn' });
    }

    const warningCount = dependencies.reduce((sum, dependency) => sum + dependency.count, 0);

    return {
      mode: warningCount > 0 ? 'warn' : 'allow',
      changes,
      dependencies,
      affectedDomains: warningCount > 0 ? ['linkedProjects', 'searchAndReporting', 'relationshipViews'] : ['searchAndReporting'],
      messageKey: `identityImpact.messages.${warningCount > 0 ? 'warn' : 'allow'}`,
      blockingCount: 0,
      warningCount,
    };
  } catch (error) {
    logger.warn('Service identity impact preview failed', error);
    return {
      mode: 'block',
      changes,
      dependencies: [],
      affectedDomains: ['searchAndReporting', 'relationshipViews'],
      messageKey: 'identityImpact.messages.unavailable',
      blockingCount: 0,
      warningCount: 0,
    };
  }
}
