'use client';

import type { ContactRelationship } from '@/types/contacts/relationships';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';

const DEFAULT_RELATIONSHIP_MUTATION_ACTOR = 'user';

interface CreateRelationshipWithPolicyInput {
  readonly data: Partial<ContactRelationship>;
}

interface UpdateRelationshipWithPolicyInput {
  readonly relationshipId: string;
  readonly updates: Partial<ContactRelationship>;
}

interface DeleteRelationshipWithPolicyInput {
  readonly relationshipId: string;
}

interface TerminateRelationshipWithPolicyInput {
  readonly relationshipId: string;
}

export async function createRelationshipWithPolicy({
  data,
}: CreateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  return ContactRelationshipService.createRelationship(data);
}

export async function updateRelationshipWithPolicy({
  relationshipId,
  updates,
}: UpdateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  return ContactRelationshipService.updateRelationship(relationshipId, updates);
}

export async function deleteRelationshipWithPolicy({
  relationshipId,
}: DeleteRelationshipWithPolicyInput): Promise<boolean> {
  return ContactRelationshipService.deleteRelationship(
    relationshipId,
    DEFAULT_RELATIONSHIP_MUTATION_ACTOR,
  );
}

export async function terminateRelationshipWithPolicy({
  relationshipId,
}: TerminateRelationshipWithPolicyInput): Promise<ContactRelationship> {
  return ContactRelationshipService.terminateRelationship(
    relationshipId,
    DEFAULT_RELATIONSHIP_MUTATION_ACTOR,
  );
}
