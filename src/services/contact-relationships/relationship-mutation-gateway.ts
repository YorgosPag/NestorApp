'use client';

import type { ContactRelationship } from '@/types/contacts/relationships';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';

interface CreateRelationshipWithPolicyInput {
  readonly data: Partial<ContactRelationship>;
  readonly actorId?: string;
}

interface UpdateRelationshipWithPolicyInput {
  readonly relationshipId: string;
  readonly updates: Partial<ContactRelationship>;
  readonly actorId?: string;
}

interface DeleteRelationshipWithPolicyInput {
  readonly relationshipId: string;
  readonly actorId?: string;
}

interface TerminateRelationshipWithPolicyInput {
  readonly relationshipId: string;
  readonly actorId?: string;
}

export async function createRelationshipWithPolicy({
  data,
  actorId,
}: CreateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  const actor = actorId ?? SYSTEM_IDENTITY.ID;
  return ContactRelationshipService.createRelationship({
    ...data,
    createdBy: actor,
    lastModifiedBy: actor,
  });
}

export async function updateRelationshipWithPolicy({
  relationshipId,
  updates,
  actorId,
}: UpdateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  const actor = actorId ?? SYSTEM_IDENTITY.ID;
  return ContactRelationshipService.updateRelationship(relationshipId, {
    ...updates,
    lastModifiedBy: actor,
  });
}

export async function deleteRelationshipWithPolicy({
  relationshipId,
  actorId,
}: DeleteRelationshipWithPolicyInput): Promise<boolean> {
  return ContactRelationshipService.deleteRelationship(
    relationshipId,
    actorId ?? SYSTEM_IDENTITY.ID,
  );
}

export async function terminateRelationshipWithPolicy({
  relationshipId,
  actorId,
}: TerminateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  return ContactRelationshipService.terminateRelationship(
    relationshipId,
    actorId ?? SYSTEM_IDENTITY.ID,
  );
}
