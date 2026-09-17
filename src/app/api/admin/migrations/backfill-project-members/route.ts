/**
 * =============================================================================
 * MIGRATION: η αρχική ομάδα των υπαρχόντων έργων + το έργο των δοχείων CDE (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * - GET  = dry-run (η **ίδια** κρίση, καμία εγγραφή)
 * - POST = εκτέλεση — ιδεμπότητη: δεύτερη εκτέλεση γράφει **0**
 *
 * ⚠️ **ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ**: μετά το push του κώδικα Β14. Πριν τον κώδικα είναι ακίνδυνη (γράφει
 * μόνο μέλη και `projectId`), αλλά ο αναγνώστης μελών που καταλαβαίνει `enrollment` ζει στον κώδικα.
 *
 * @module api/admin/migrations/backfill-project-members
 * @enterprise ADR-704 — Admin Migration-Runner SSoT (createMigrationRoute)
 *
 * 🔒 SECURITY: super_admin ONLY (ADR-703, μέσω `runMigration`)
 */

import { createMigrationRoute } from '@/lib/admin-migration-runner';

import { backfillProjectTeams } from './backfill-project-members-operations';

const migrationRoute = createMigrationRoute({
  name: 'backfill-project-members',
  // CHECK 3.78 — η βαθμίδα ΟΡΑΤΗ στην ανασκόπηση· ο τύπος επιτρέπει ΜΟΝΟ ό,τι επιβάλλει το εργοστάσιο.
  category: 'SENSITIVE',
  run: async (db, { dryRun }) => {
    const report = await backfillProjectTeams(db, { dryRun });
    return {
      body: { dryRun, ...report },
      audit: {
        projectsScanned: report.projectsScanned,
        membersEnrolled: report.membersEnrolled,
        containersSealed: report.containersSealed.length,
      },
    };
  },
});

export const GET = migrationRoute.GET;
export const POST = migrationRoute.POST;
