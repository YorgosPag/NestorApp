/**
 * POST /api/properties — Link sold properties to contacts (utility)
 *
 * Extracted from route.ts for SRP (ADR-281 Batch 2).
 *
 * @module api/properties/property-link-sold.handler
 * @permission requiredGlobalRoles: super_admin
 * @rateLimit STANDARD (60 req/min)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { withAuth } from "@/lib/auth";
import type { AuthContext, PermissionCache } from "@/lib/auth";
import { UNIT_SALE_STATUS } from "@/constants/property-statuses-enterprise";
import { COLLECTIONS } from "@/config/firestore-collections";
import { withStandardRateLimit } from "@/lib/middleware/with-rate-limit";
import { createModuleLogger } from "@/lib/telemetry";
import { getErrorMessage } from "@/lib/error-utils";
import { EntityAuditService } from "@/services/entity-audit.service";
import { ENTITY_TYPES } from "@/config/domain-constants";

const logger = createModuleLogger("PropertiesLinkSold");

// ============================================================================
// TYPES
// ============================================================================

type LinkUnitsSuccess = {
  success: true;
  message: string;
  linkedProperties: number;
  updates: Array<{
    propertyId: string;
    contactId: string;
    contactName: string;
  }>;
};

type LinkUnitsError = {
  success: false;
  error: string;
  details?: string;
};

type LinkUnitsResponse = LinkUnitsSuccess | LinkUnitsError;

// ============================================================================
// POST — Link Sold Properties to Contacts
// ============================================================================

export const POST = withStandardRateLimit(async (request: NextRequest) => {
  const handler = withAuth<LinkUnitsResponse>(
    async (
      _req: NextRequest,
      ctx: AuthContext,
      _cache: PermissionCache,
    ): Promise<NextResponse<LinkUnitsResponse>> => {
      try {
        logger.info(
          "[Properties/LinkSold] Linking sold properties to contacts",
          {
            userId: ctx.uid,
            globalRole: ctx.globalRole,
            companyId: ctx.companyId,
          },
        );

        // ============================================================================
        // STEP 1: GET CONTACTS (Admin SDK)
        // ============================================================================

        logger.info("[Properties/LinkSold] Getting contacts");
        const contactsSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.CONTACTS)
          .get();

        const contacts: Array<{ id: string; name: string }> = [];
        contactsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.firstName &&
            typeof data.firstName === "string" &&
            data.firstName.trim()
          ) {
            contacts.push({
              id: doc.id,
              name: `${data.firstName} ${data.lastName || ""}`.trim(),
            });
          }
        });

        logger.info("[Properties/LinkSold] Found contacts with names", {
          count: contacts.length,
        });

        if (contacts.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: "No contacts found",
              details: "Create contacts first before linking properties",
            },
            { status: 404 },
          );
        }

        // ============================================================================
        // STEP 2: GET SOLD UNITS (Admin SDK)
        // ============================================================================

        logger.info("[Properties/LinkSold] Getting sold properties");
        const propertiesSnapshot = await getAdminFirestore()
          .collection(COLLECTIONS.PROPERTIES)
          .get();

        const soldPropertiesToLink: Array<{
          id: string;
          buildingId?: unknown;
          companyId?: string;
          name?: string;
        }> = [];
        propertiesSnapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.status === "sold" &&
            (!data.soldTo || data.soldTo === UNIT_SALE_STATUS.NOT_SOLD)
          ) {
            soldPropertiesToLink.push({
              id: doc.id,
              buildingId: data.buildingId,
              companyId:
                typeof data.companyId === "string" ? data.companyId : undefined,
              name: typeof data.name === "string" ? data.name : undefined,
            });
          }
        });

        logger.info(
          "[Properties/LinkSold] Found sold properties without contacts",
          { count: soldPropertiesToLink.length },
        );

        if (soldPropertiesToLink.length === 0) {
          return NextResponse.json({
            success: true,
            message: "All sold properties already have contacts!",
            linkedProperties: 0,
            updates: [],
          });
        }

        // ============================================================================
        // STEP 3: LINK UNITS TO CONTACTS (Admin SDK)
        // ============================================================================

        const updates: Array<{
          propertyId: string;
          contactId: string;
          contactName: string;
        }> = [];
        for (
          let i = 0;
          i < Math.min(soldPropertiesToLink.length, contacts.length * 3);
          i++
        ) {
          const property = soldPropertiesToLink[i];
          const contact = contacts[i % contacts.length]; // Cycle through contacts

          updates.push({
            propertyId: property.id,
            contactId: contact.id,
            contactName: contact.name,
          });
        }

        logger.info("[Properties/LinkSold] Linking properties to contacts", {
          count: updates.length,
        });

        // Perform updates using Admin SDK.
        // Build a lookup of property metadata harvested in STEP 2 so we can
        // emit a per-property audit row without an extra read round-trip.
        const propertyMeta = new Map(
          soldPropertiesToLink.map((p) => [p.id, { companyId: p.companyId, name: p.name }]),
        );

        for (const update of updates) {
          await getAdminFirestore()
            .collection(COLLECTIONS.PROPERTIES)
            .doc(update.propertyId)
            .update({
              soldTo: update.contactId,
            });

          // Per-entity audit trail (feeds the property "Ιστορικό" tab via ADR-195).
          // Fire-and-forget — errors never break the batch.
          const meta = propertyMeta.get(update.propertyId);
          await EntityAuditService.recordChange({
            entityType: ENTITY_TYPES.PROPERTY,
            entityId: update.propertyId,
            entityName: meta?.name ?? null,
            action: 'updated',
            changes: [
              {
                field: 'soldTo',
                oldValue: null,
                newValue: update.contactId,
                label: `Αγοραστής: ${update.contactName}`,
              },
            ],
            performedBy: ctx.uid,
            performedByName: ctx.email ?? null,
            companyId: meta?.companyId ?? ctx.companyId,
          });

          logger.info("[Properties/LinkSold] Property linked to contact", {
            propertyId: update.propertyId,
            contactName: update.contactName,
            contactId: update.contactId,
          });
        }

        logger.info("[Properties/LinkSold] Complete", {
          linkedCount: updates.length,
        });

        return NextResponse.json({
          success: true,
          message: `Successfully linked ${updates.length} properties to contacts!`,
          linkedProperties: updates.length,
          updates: updates,
        });
      } catch (error) {
        logger.error("[Properties/LinkSold] Error", {
          error: getErrorMessage(error),
          userId: ctx.uid,
          companyId: ctx.companyId,
        });

        return NextResponse.json(
          {
            success: false,
            error: "Failed to link properties to contacts",
            details: getErrorMessage(error),
          },
          { status: 500 },
        );
      }
    },
    { requiredGlobalRoles: "super_admin" },
  );

  return handler(request);
});
