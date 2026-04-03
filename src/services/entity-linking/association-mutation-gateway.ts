'use client';

import { AssociationService } from '@/services/association.service';
import type { CreateContactLinkInput, LinkResult } from '@/types/associations';

interface LinkContactToEntityWithPolicyInput {
  readonly input: CreateContactLinkInput;
}

interface UnlinkContactWithPolicyInput {
  readonly linkId: string;
  readonly updatedBy: string;
}

interface UpdateContactLinkRoleWithPolicyInput {
  readonly linkId: string;
  readonly role: string;
  readonly updatedBy: string;
}

export async function linkContactToEntityWithPolicy({
  input,
}: LinkContactToEntityWithPolicyInput): Promise<LinkResult> {
  return AssociationService.linkContactToEntity(input);
}

export async function unlinkContactWithPolicy({
  linkId,
  updatedBy,
}: UnlinkContactWithPolicyInput): Promise<LinkResult> {
  return AssociationService.unlinkContact(linkId, updatedBy);
}

export async function updateContactLinkRoleWithPolicy({
  linkId,
  role,
  updatedBy,
}: UpdateContactLinkRoleWithPolicyInput): Promise<LinkResult> {
  return AssociationService.updateContactLinkRole(linkId, role, updatedBy);
}
