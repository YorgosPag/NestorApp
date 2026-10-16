/**
 * Conveyance — το αποτέλεσμα μιας εντολής (ADR-901 §5.1): νέα υπόθεση + αλλαγές ίχνους, ή απόρριψη.
 *
 * Ένα σημείο για τον τύπο και τους δύο κατασκευαστές του, ώστε κάθε πυρήνας εντολών (`apply-command` ·
 * `case-party-commands`) να γράφει το ίδιο σχήμα χωρίς να εισάγει ο ένας τον άλλον.
 *
 * **Layering**: leaf.
 *
 * @module lib/conveyance/command-result
 */

import type { AuditFieldChange } from '@/types/audit-trail';
import type { ConveyanceCase } from '@/types/conveyance-case';
import type { CommandRejection } from './conveyance-commands';

export type CommandResult =
  | { readonly ok: true; readonly next: ConveyanceCase; readonly changes: readonly AuditFieldChange[] }
  | { readonly ok: false; readonly rejection: CommandRejection };

export const reject = (rejection: CommandRejection): CommandResult => ({ ok: false, rejection });

export function change(field: string, oldValue: AuditFieldChange['oldValue'], newValue: AuditFieldChange['newValue']): AuditFieldChange {
  return { field, oldValue, newValue };
}
