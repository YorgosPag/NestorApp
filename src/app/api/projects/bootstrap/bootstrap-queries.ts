/**
 * =============================================================================
 * PROJECTS BOOTSTRAP - Firestore Query Functions
 * =============================================================================
 *
 * Data-fetching logic extracted from route.ts for SRP compliance.
 * Handles: company loading (admin/tenant), project fetching, building counts.
 *
 * @module api/projects/bootstrap/queries
 */

import { getErrorMessage } from "@/lib/error-utils";
import type { AuthContext } from "@/lib/auth";
import { COLLECTIONS } from "@/config/firestore-collections";
import { FIELDS } from "@/config/firestore-field-constants";
import type { CompanyContact } from "@/types/contacts";
import { chunkArray } from "@/lib/array-utils";
import { createModuleLogger } from "@/lib/telemetry";
import type { BootstrapProject } from "./bootstrap-helpers";
import { mapProjectDocument } from "./bootstrap-helpers";
import { resolveCompanyDisplayName } from "@/services/company/company-name-resolver";

const logger = createModuleLogger("ProjectsBootstrapQueries");

const FIRESTORE_IN_LIMIT = 10;

// ============================================================================
// TYPES
// ============================================================================

type CompanyFetchResult =
  | {
      ok: true;
      companyIds: string[];
      companyMap: Map<string, { id: string; name: string }>;
    }
  | { ok: false; emptyReason: string };

// ============================================================================
// COMPANY FETCHING — Hybrid Admin/Tenant Pattern
// ============================================================================

export async function fetchCompanies(
  adminDb: FirebaseFirestore.Firestore,
  ctx: AuthContext,
): Promise<CompanyFetchResult> {
  const isAdmin =
    ctx.globalRole === "super_admin" || ctx.globalRole === "company_admin";
  const companyIds: string[] = [];
  const companyMap = new Map<string, { id: string; name: string }>();

  try {
    if (isAdmin) {
      const adminResult = await fetchCompaniesAdmin(adminDb, companyIds, companyMap);
      if (!adminResult.ok && ctx.companyId) {
        logger.info("[Bootstrap] navigation_companies empty, falling back to tenant mode", { companyId: ctx.companyId });
        return fetchCompaniesTenant(adminDb, ctx, [], new Map());
      }
      return adminResult;
    }
    return fetchCompaniesTenant(adminDb, ctx, companyIds, companyMap);
  } catch (error) {
    logger.error("[Bootstrap] Failed to fetch companies", {
      mode: isAdmin ? "Admin" : "Tenant",
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(
      `Failed to fetch companies: ${getErrorMessage(error)}. Mode: ${isAdmin ? "Admin" : "Tenant"}.`,
    );
  }
}

async function fetchCompaniesAdmin(
  adminDb: FirebaseFirestore.Firestore,
  companyIds: string[],
  companyMap: Map<string, { id: string; name: string }>,
): Promise<CompanyFetchResult> {
  logger.info("[Bootstrap] Admin mode - Loading from navigation_companies");

  const navSnapshot = await adminDb.collection(COLLECTIONS.NAVIGATION).get();

  if (navSnapshot.empty) {
    logger.warn("[Bootstrap] No navigation companies found");
    return {
      ok: false,
      emptyReason:
        "No navigation companies configured - use + button to add companies",
    };
  }

  const navContactIds: string[] = [];
  navSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.contactId) navContactIds.push(data.contactId);
  });

  logger.info("[Bootstrap] Found navigation companies", {
    count: navContactIds.length,
  });

  if (navContactIds.length > 0) {
    const contactChunks = chunkArray(navContactIds, FIRESTORE_IN_LIMIT);
    for (const chunk of contactChunks) {
      const contactsSnapshot = await adminDb
        .collection(COLLECTIONS.CONTACTS)
        .where("__name__", "in", chunk)
        .where(FIELDS.TYPE, "==", "company")
        .get();

      contactsSnapshot.docs.forEach((doc) => {
        const data = doc.data() as Partial<CompanyContact>;
        companyMap.set(doc.id, {
          id: doc.id,
          name: resolveCompanyDisplayName({
            id: doc.id,
            companyName: data.companyName,
            tradeName: data.tradeName,
            legalName: data.legalName,
            displayName: data.displayName,
          }),
        });
        companyIds.push(doc.id);
      });
    }
  }

  logger.info("[Bootstrap] Admin loaded companies", {
    count: companyIds.length,
  });
  return { ok: true, companyIds, companyMap };
}

async function fetchCompaniesTenant(
  adminDb: FirebaseFirestore.Firestore,
  ctx: AuthContext,
  companyIds: string[],
  companyMap: Map<string, { id: string; name: string }>,
): Promise<CompanyFetchResult> {
  logger.info("[Bootstrap] Tenant isolation mode");

  if (!ctx.companyId) {
    logger.warn("[Bootstrap] User has no companyId");
    return {
      ok: false,
      emptyReason: "User has no company assigned - contact administrator",
    };
  }

  const companyDoc = await adminDb
    .collection(COLLECTIONS.COMPANIES)
    .doc(ctx.companyId)
    .get();

  if (!companyDoc.exists) {
    logger.warn("[Bootstrap] Company not found in companies collection", { companyId: ctx.companyId });
    return {
      ok: false,
      emptyReason: "Company not found - returning empty bootstrap data",
    };
  }

  const data = companyDoc.data() as { name?: string };
  companyMap.set(ctx.companyId, {
    id: ctx.companyId,
    name: data?.name ?? ctx.companyId,
  });
  companyIds.push(ctx.companyId);

  logger.info("[Bootstrap] Loaded 1 company", { companyId: ctx.companyId });
  return { ok: true, companyIds, companyMap };
}

// ============================================================================
// PROJECT FETCHING — Chunked Firestore queries
// ============================================================================

export async function fetchProjects(
  adminDb: FirebaseFirestore.Firestore,
  companyIds: string[],
): Promise<BootstrapProject[]> {
  if (companyIds.length === 0) {
    logger.warn("[Bootstrap] No companies - skipping projects");
    return [];
  }

  try {
    if (companyIds.length <= FIRESTORE_IN_LIMIT) {
      const snapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where(FIELDS.COMPANY_ID, "in", companyIds)
        .get();
      const projects = snapshot.docs.map((doc) => mapProjectDocument(doc));
      logger.info("[Bootstrap] Fetched projects", { count: projects.length });
      return projects;
    }

    const chunks = chunkArray(companyIds, FIRESTORE_IN_LIMIT);
    logger.info("[Bootstrap] Chunking project queries", {
      chunks: chunks.length,
    });

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await adminDb
          .collection(COLLECTIONS.PROJECTS)
          .where(FIELDS.COMPANY_ID, "in", chunk)
          .get();
        return snapshot.docs.map((doc) => mapProjectDocument(doc));
      }),
    );

    const projects = results.flat();
    logger.info("[Bootstrap] Fetched projects", { count: projects.length });
    return projects;
  } catch (error) {
    logger.error("[Bootstrap] Failed to fetch projects", {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw new Error(`Failed to fetch projects: ${getErrorMessage(error)}`);
  }
}

// ============================================================================
// COMPANY DISPLAY NAME RESOLUTION — linkedCompanyId → contacts
// ============================================================================

/**
 * Resolves company display names for projects that have a linkedCompanyId.
 * Fetches the corresponding contacts and returns a map: contactId → displayName.
 * Used to show the business entity name (e.g. "ALFA") in breadcrumbs.
 */
export async function resolveProjectCompanyNames(
  adminDb: FirebaseFirestore.Firestore,
  projects: import("./bootstrap-helpers").BootstrapProject[],
): Promise<Map<string, string>> {
  const linkedIds = [
    ...new Set(
      projects
        .map((p) => p.linkedCompanyId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  if (linkedIds.length === 0) return new Map();

  const nameMap = new Map<string, string>();
  const chunks = chunkArray(linkedIds, FIRESTORE_IN_LIMIT);

  for (const chunk of chunks) {
    const snapshot = await adminDb
      .collection(COLLECTIONS.CONTACTS)
      .where("__name__", "in", chunk)
      .get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Partial<CompanyContact>;
      nameMap.set(
        doc.id,
        resolveCompanyDisplayName({
          id: doc.id,
          companyName: data.companyName,
          tradeName: data.tradeName,
          legalName: data.legalName,
          displayName: data.displayName,
        }),
      );
    });
  }

  return nameMap;
}

// ============================================================================
// BUILDING COUNT FETCHING — PERF-001
// ============================================================================

export async function fetchBuildingCounts(
  adminDb: FirebaseFirestore.Firestore,
  projectIds: string[],
): Promise<Map<string, number>> {
  const countMap = new Map<string, number>();

  if (projectIds.length === 0) return countMap;

  try {
    const chunks = chunkArray(projectIds, FIRESTORE_IN_LIMIT);

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const snapshot = await adminDb
          .collection(COLLECTIONS.BUILDINGS)
          .where(FIELDS.PROJECT_ID, "in", chunk)
          .get();
        return snapshot.docs;
      }),
    );

    const allDocs = results.flat();
    logger.info("[Bootstrap] Fetched buildings", { count: allDocs.length });

    allDocs.forEach((doc) => {
      const projectId = doc.data().projectId;
      if (projectId) {
        countMap.set(projectId, (countMap.get(projectId) || 0) + 1);
      }
    });
  } catch (error) {
    logger.error("[Bootstrap] Failed to fetch buildings (non-blocking)", {
      error: getErrorMessage(error),
    });
  }

  return countMap;
}
