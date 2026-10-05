/**
 * =============================================================================
 * createTrashListRoute — `GET /api/{entity}/trash`, once
 * =============================================================================
 *
 * ADR-281 promised "ENAS kentrikopoiimenos mixanismos, oxi copy-paste ana
 * entity" and delivered it for delete / restore / permanent-delete. The fourth
 * operation — *reading* the bin — never got there: `buildings`, `projects`,
 * `properties`, `parking` and `storages` each shipped a 79-line route file that
 * differed only in a collection, a sort field, a permission and a noun.
 *
 * This factory closes that gap by composing what already exists rather than
 * re-implementing any of it:
 *
 *   defineRoute (ADR-602)      rate-limit tier + withAuth + params/body plumbing
 *   resolveTenantScope         who may list whose rows (security decision, SSoT)
 *   listTrashed (ADR-281)      the Firestore read + ordering
 *   SOFT_DELETE_CONFIG         the per-entity contract, as data
 *
 * **The wire contract is frozen, deliberately.** The success envelope keeps its
 * per-entity key (`{ success, buildings, count }`) because
 * `EntityTrashSpec.selectItems` on the client unwraps exactly that, and the 500
 * envelope keeps its `{ error, details }` pair with the entity's own noun. Both
 * are reproduced from config rather than normalised — a unified envelope would
 * be a separate, versioned rollout, not a side effect of de-duplication.
 *
 * @module lib/api/trash-list-route
 * @enterprise ADR-697 — Trash-List Route SSoT
 * @see ADR-281 SSOT Soft-Delete System · ADR-602 API Route-Handler Factory
 */

import 'server-only';

import { NextResponse } from 'next/server';
import { defineRoute } from '@/lib/api/define-route';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { resolveTenantScopeFromUrl } from '@/lib/auth/tenant-scope';
import {
  getArchiveConfig,
  getTrashListConfig,
  type TrashListConfig,
} from '@/lib/firestore/soft-delete-config';
import { listArchived, listTrashed } from '@/lib/firestore/soft-delete-engine';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

/**
 * Build the `GET` export for an entity's trash endpoint.
 *
 * Throws at module-evaluation time — i.e. at build, not at request time — when
 * asked for an entity that publishes no trash-list contract. A route file that
 * should not exist must fail loudly on the first import rather than 500 for
 * whoever opens the bin.
 *
 * @example
 * // src/app/api/buildings/trash/route.ts
 * export const GET = createTrashListRoute('building');
 */
export function createTrashListRoute(entityType: SoftDeletableEntityType) {
  const config = getTrashListConfig(entityType);

  if (!config) {
    throw new Error(
      `createTrashListRoute: '${entityType}' publishes no trash list. ` +
        `Add a 'trashList' block to SOFT_DELETE_CONFIG before adding the route.`,
    );
  }

  return createRetiredListRoute(entityType, config, {
    adjective: 'deleted',
    loggerName: config.loggerName,
    list: listTrashed,
  });
}

/**
 * Build the `GET` export for an entity's archive endpoint (ADR-329 §3.9).
 *
 * Το αρχείο είναι οι **ίδιες** γραμμές σε άλλη κατάσταση, άρα μοιράζεται το συμβόλαιο του
 * κάδου (κλειδί απάντησης, ταξινόμηση, άδεια προβολής). Αποτυγχάνει στο build όταν η
 * οντότητα δεν έχει αρχείο — ίδιος κανόνας με το {@link createTrashListRoute}.
 *
 * @example
 * // src/app/api/properties/archived/route.ts
 * export const GET = createArchiveListRoute('property');
 */
export function createArchiveListRoute(entityType: SoftDeletableEntityType) {
  const config = getTrashListConfig(entityType);

  if (!config || !getArchiveConfig(entityType)) {
    throw new Error(
      `createArchiveListRoute: '${entityType}' publishes no archive list. ` +
        `It needs both 'archive' and 'trashList' blocks in SOFT_DELETE_CONFIG.`,
    );
  }

  return createRetiredListRoute(entityType, config, {
    adjective: 'archived',
    loggerName: `${config.loggerName}:archive`,
    list: listArchived,
  });
}

/** Ό,τι διαφέρει ανάμεσα στη λίστα του κάδου και στη λίστα του αρχείου. */
interface RetiredListKind {
  /** Spliced into log lines and the 500 message (`Failed to fetch deleted buildings`). */
  readonly adjective: string;
  readonly loggerName: string;
  readonly list: typeof listTrashed;
}

function createRetiredListRoute(
  entityType: SoftDeletableEntityType,
  config: TrashListConfig,
  kind: RetiredListKind,
) {
  const logger = createModuleLogger(kind.loggerName);
  const { responseKey, viewPermission } = config;
  const labelPluralEn = `${kind.adjective} ${config.labelPluralEn}`;

  return defineRoute({
    rateLimit: 'standard',
    auth: { permissions: viewPermission },
    handler: async ({ req, auth }) => {
      try {
        const scope = resolveTenantScopeFromUrl(req.url, auth);

        logger.info(`Fetching ${labelPluralEn}`, {
          companyId: scope.companyId,
          userId: auth.uid,
        });

        const rows = await kind.list(getAdminFirestore(), entityType, scope.companyId);

        logger.info(`Found ${labelPluralEn}`, { count: rows.length });

        return NextResponse.json({
          success: true,
          [responseKey]: rows,
          count: rows.length,
        });
      } catch (error) {
        // Caught here rather than left to defineRoute so the 500 envelope stays
        // byte-identical to what these five endpoints have always returned.
        logger.error(`Error fetching ${labelPluralEn}`, {
          error: getErrorMessage(error),
        });
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch ${labelPluralEn}`,
            details: getErrorMessage(error),
          },
          { status: 500 },
        );
      }
    },
  });
}
