/**
 * =============================================================================
 * PROJECTS BOOTSTRAP - Types & Helpers
 * =============================================================================
 *
 * Extracted from route.ts for SRP compliance (Google file size standard ≤500 lines)
 *
 * @module api/projects/bootstrap/helpers
 */

import { normalizeToISO } from "@/lib/date-local";

// ============================================================================
// TYPES - Enterprise Bootstrap Response
// ============================================================================

export interface BootstrapCompany {
  id: string;
  name: string;
  projectCount: number;
}

export interface BootstrapProject {
  id: string;
  projectCode: string | null;
  name: string;
  companyId: string;
  status: string;
  updatedAt: string | null; // ISO string (enterprise requirement)
  createdAt: string | null; // ISO string
  // Precomputed aggregates (if available)
  totalUnits?: number;
  soldUnits?: number;
  soldAreaM2?: number;
  // 🏢 PERF-001: Building count from bootstrap (eliminates realtime listener)
  buildingCount: number;
}

export interface BootstrapResponse {
  companies: BootstrapCompany[];
  projects: BootstrapProject[];
  loadedAt: string;
  source: "cache" | "firestore";
  cached: boolean;
}

// ============================================================================
// DOCUMENT MAPPER
// ============================================================================

/**
 * 📄 Map Firestore document to BootstrapProject
 * Enterprise requirement: ISO strings, null safety
 * 🏢 ENTERPRISE: Compatible with Admin SDK QueryDocumentSnapshot
 */
export function mapProjectDocument(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): BootstrapProject {
  const data = doc.data();

  return {
    id: doc.id,
    projectCode: typeof data.projectCode === "string" ? data.projectCode : null,
    name: typeof data.name === "string" ? data.name : "Unnamed Project",
    companyId: typeof data.companyId === "string" ? data.companyId : "",
    status: typeof data.status === "string" ? data.status : "unknown",
    updatedAt: normalizeToISO(data.updatedAt),
    createdAt: normalizeToISO(data.createdAt),
    // Precomputed aggregates (if available in document)
    totalUnits:
      typeof data.totalUnits === "number" ? data.totalUnits : undefined,
    soldUnits: typeof data.soldUnits === "number" ? data.soldUnits : undefined,
    soldAreaM2:
      typeof data.soldAreaM2 === "number" ? data.soldAreaM2 : undefined,
    // 🏢 PERF-001: Building count (will be populated after buildings query)
    buildingCount: 0,
  };
}
