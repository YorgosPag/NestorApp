'use client';

import { ContactsService } from '@/services/contacts.service';
import type { Contact } from '@/types/contacts';

interface CreateContactWithPolicyInput {
  readonly contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>;
}

interface DeleteContactWithPolicyInput {
  readonly id: string;
}

interface DeleteMultipleContactsWithPolicyInput {
  readonly ids: string[];
}

interface RestoreMultipleDeletedContactsWithPolicyInput {
  readonly ids: string[];
}

interface ToggleContactFavoriteWithPolicyInput {
  readonly contactId: string;
  readonly currentStatus: boolean;
}

export async function createContactWithPolicy({
  contactData,
}: CreateContactWithPolicyInput): Promise<string> {
  return ContactsService.createContact(contactData);
}

export async function deleteContactWithPolicy({
  id,
}: DeleteContactWithPolicyInput): Promise<void> {
  return ContactsService.deleteContact(id);
}

export async function deleteMultipleContactsWithPolicy({
  ids,
}: DeleteMultipleContactsWithPolicyInput): Promise<void> {
  return ContactsService.deleteMultipleContacts(ids);
}

export async function restoreMultipleDeletedContactsWithPolicy({
  ids,
}: RestoreMultipleDeletedContactsWithPolicyInput): Promise<void> {
  return ContactsService.restoreMultipleDeletedContacts(ids);
}

export async function toggleContactFavoriteWithPolicy({
  contactId,
  currentStatus,
}: ToggleContactFavoriteWithPolicyInput): Promise<void> {
  return ContactsService.toggleFavorite(contactId, currentStatus);
}
