/**
 * =============================================================================
 * ENTITY ROUTES - CENTRALIZED ENTITY NAVIGATION DEFINITIONS
 * =============================================================================
 *
 * Single source of truth for entity-related routes.
 * Eliminates hardcoded template literals across the codebase.
 *
 * @module lib/routes/entityRoutes
 */

export const ENTITY_ROUTES = {
  crm: {
    leads: '/crm/leads',
    lead: (id: string) => `/crm/leads/${id}`,
    tasks: '/crm/tasks',
    task: (id: string) => `/crm/tasks/${id}`,
  },
  contacts: {
    list: '/contacts',
    withFilter: (term: string) => `/contacts?filter=${encodeURIComponent(term)}`,
    withId: (id: string) => `/contacts?contactId=${id}`,
  },
  units: {
    list: '/units',
    withId: (id: string) => `/units?unitId=${id}`,
  },
  spaces: {
    parking: (id: string) => `/spaces/parking?parkingId=${id}`,
    storage: (id: string) => `/spaces/storage?storageId=${id}`,
  },
  obligations: {
    list: '/obligations',
    edit: (id: string) => `/obligations/${id}/edit`,
  },
} as const;
