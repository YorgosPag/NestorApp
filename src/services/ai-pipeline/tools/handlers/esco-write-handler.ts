/**
 * ESCO WRITE HANDLER — Server-side ESCO disambiguation enforcement
 * Extracted from contact-handler to comply with 500-line limit (ADR N.7.1)
 *
 * @module services/ai-pipeline/tools/handlers/esco-write-handler
 * @see ADR-132 (ESCO Integration)
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import {
  type AgenticContext,
  type ToolResult,
  auditWrite,
  buildAttribution,
  logger,
} from '../executor-shared';
import { nowISO } from '@/lib/date-local';

/**
 * Execute set_contact_esco — Write ESCO occupation and/or skills to a contact.
 * Server-side enforcement: ALWAYS searches ESCO, blocks ambiguous writes
 * unless `disambiguated=true` with valid URI.
 */
export async function executeSetContactEsco(
  args: Record<string, unknown>,
  ctx: AgenticContext
): Promise<ToolResult> {
  if (!ctx.isAdmin) {
    return { success: false, error: 'set_contact_esco is admin-only.' };
  }

  const contactId = String(args.contactId ?? '').trim();
  if (!contactId) {
    return { success: false, error: 'contactId is required.' };
  }

  const db = getAdminFirestore();
  const docSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
  if (!docSnap.exists) {
    return { success: false, error: `Η επαφή ${contactId} δεν βρέθηκε.` };
  }

  const updateData: Record<string, unknown> = {
    updatedAt: nowISO(),
    lastModifiedBy: buildAttribution(ctx),
  };
  const changes: string[] = [];

  // Occupation fields
  const profession = typeof args.profession === 'string' ? args.profession.trim() : null;
  const escoUri = typeof args.escoUri === 'string' ? args.escoUri : '';

  if (profession) {
    // ── SERVER-SIDE ESCO ENFORCEMENT (occupation) — ALWAYS runs ──
    const { enforceEscoOccupation } = await import('../esco-search-utils');
    const result = await enforceEscoOccupation(profession);
    const isDisambiguated = args.disambiguated === true;

    if (!result.allowed && !isDisambiguated) {
      // >1 matches + user hasn't confirmed → BLOCK
      logger.info('ESCO enforcement: blocked occupation write (not disambiguated)', {
        profession, matchCount: result.matches?.length, requestId: ctx.requestId,
      });
      return {
        success: false,
        data: { escoMatchesFound: true, matches: result.matches, requestedProfession: profession },
        error: [
          `Βρέθηκαν ${result.matches?.length} επαγγέλματα στα ESCO για "${profession}".`,
          'Δείξε τις επιλογές στον χρήστη και ρώτησε "Ποιο εννοείς;".',
          'Μετά κάλεσε set_contact_esco με το σωστό escoUri/iscoCode και disambiguated=true.',
        ].join(' '),
      };
    }

    if (!result.allowed && isDisambiguated && escoUri) {
      // User confirmed → validate URI exists in ESCO matches
      const validUri = result.matches?.some(m => m.uri === escoUri);
      if (!validUri) {
        logger.warn('ESCO enforcement: invalid URI after disambiguation', {
          profession, escoUri, requestId: ctx.requestId,
        });
        return {
          success: false,
          data: { escoMatchesFound: true, matches: result.matches, requestedProfession: profession },
          error: `Το escoUri "${escoUri}" δεν αντιστοιχεί σε κανένα ESCO αποτέλεσμα για "${profession}". Ξαναδείξε τις επιλογές.`,
        };
      }
    }

    updateData.profession = profession;
    updateData.escoUri = escoUri;
    updateData.escoLabel = typeof args.escoLabel === 'string' ? args.escoLabel : '';
    updateData.iscoCode = typeof args.iscoCode === 'string' ? args.iscoCode : '';
    changes.push(`profession: ${profession}`);
  }

  // Skills — MERGE with existing (empty array = no change)
  if (Array.isArray(args.skills) && (args.skills as unknown[]).length > 0) {
    const newSkills = (args.skills as Array<Record<string, unknown>>)
      .filter(s => typeof s.label === 'string' && s.label.trim())
      .map(s => ({ uri: typeof s.uri === 'string' ? s.uri : '', label: String(s.label).trim() }));

    if (newSkills.length > 0) {
      // ── SERVER-SIDE ESCO ENFORCEMENT (skills) — ALWAYS runs ──
      const { enforceEscoSkill } = await import('../esco-search-utils');
      const isDisambiguated = args.disambiguated === true;

      for (const skill of newSkills) {
        const result = await enforceEscoSkill(skill.label);

        if (!result.allowed && !isDisambiguated) {
          // >1 matches + user hasn't confirmed → BLOCK
          logger.info('ESCO enforcement: blocked skill write (not disambiguated)', {
            skillLabel: skill.label, matchCount: result.matches?.length, requestId: ctx.requestId,
          });
          return {
            success: false,
            data: { escoSkillMatchesFound: true, matches: result.matches, requestedSkill: skill.label },
            error: [
              `Βρέθηκαν ${result.matches?.length} δεξιότητες στα ESCO για "${skill.label}".`,
              'Δείξε τις επιλογές στον χρήστη και ρώτησε ποια εννοεί.',
              'Μετά κάλεσε set_contact_esco με σωστό uri+label και disambiguated=true.',
            ].join(' '),
          };
        }

        if (!result.allowed && isDisambiguated && skill.uri) {
          // User confirmed → validate URI exists in ESCO matches
          const validUri = result.matches?.some(m => m.uri === skill.uri);
          if (!validUri) {
            logger.warn('ESCO enforcement: invalid skill URI after disambiguation', {
              skillLabel: skill.label, skillUri: skill.uri, requestId: ctx.requestId,
            });
            return {
              success: false,
              data: { escoSkillMatchesFound: true, matches: result.matches, requestedSkill: skill.label },
              error: `Το URI "${skill.uri}" δεν αντιστοιχεί σε ESCO δεξιότητα για "${skill.label}". Ξαναδείξε τις επιλογές.`,
            };
          }
        }
      }

      // ── MERGE with existing skills (deduplicate by URI or label) ──
      const contactData = docSnap.data() as Record<string, unknown>;
      const existing = Array.isArray(contactData.escoSkills)
        ? (contactData.escoSkills as Array<{ uri: string; label: string }>)
        : [];
      const merged = new Map<string, { uri: string; label: string }>();
      for (const s of existing) merged.set(s.uri || `label:${s.label}`, s);
      for (const s of newSkills) merged.set(s.uri || `label:${s.label}`, s);

      updateData.escoSkills = [...merged.values()];
      changes.push(`skills: ${newSkills.map(s => s.label).join(', ')}`);
    }
  }

  if (changes.length === 0) {
    return { success: false, error: 'Provide profession and/or skills to update.' };
  }

  await db.collection(COLLECTIONS.CONTACTS).doc(contactId).update(updateData);
  await auditWrite(ctx, COLLECTIONS.CONTACTS, contactId, 'update', updateData);

  // ADR-195: canonical entity audit trail (SSoT)
  const existingData = docSnap.data() as Record<string, unknown>;
  const escoChanges: AuditFieldChange[] = [];
  if (profession) {
    escoChanges.push({
      field: 'profession',
      oldValue: typeof existingData.profession === 'string' ? existingData.profession : null,
      newValue: profession,
      label: 'Επάγγελμα',
    });
  }
  if (updateData.escoSkills) {
    escoChanges.push({ field: 'escoSkills', oldValue: null, newValue: changes.join(' | '), label: 'Δεξιότητες ESCO' });
  }
  if (escoChanges.length > 0) {
    await EntityAuditService.recordChange({
      entityType: ENTITY_TYPES.CONTACT,
      entityId: contactId,
      entityName: String(existingData.displayName ?? null) || null,
      action: 'updated',
      changes: escoChanges,
      performedBy: ctx.channelSenderId || 'system',
      performedByName: buildAttribution(ctx),
      companyId: ctx.companyId,
    });
  }

  const { emitEntitySyncSignal } = await import(
    '@/services/ai-pipeline/shared/contact-lookup'
  );
  emitEntitySyncSignal('contacts', 'UPDATED', contactId, ctx.companyId);

  logger.info('Contact ESCO data updated', { contactId, changes, requestId: ctx.requestId });

  return {
    success: true,
    data: { contactId, changes, updated: true },
    count: 1,
  };
}
