/**
 * Storage Rules — συνημμένα (εξωτερικές αναφορές) DXF (ADR-736 Φ3)
 *
 * Pattern: company_scoped_no_project
 *
 * Path: /companies/{companyId}/dxf-external-references/{fileName}
 *
 * Rule: read   — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *       write  — (belongsToCompany(companyId) || isSuperAdmin())
 *                && size < 25 MB && contentType.matches('image/.*')
 *       delete — (belongsToCompany(companyId) || isSuperAdmin())
 *
 * Το συμβόλαιο που φυλάει αυτό το suite: **ο απλός μηχανικός γράφει εδώ**. Η εισαγωγή
 * τοπογραφικού με υπόβαθρα είναι καθημερινή ενέργεια, όχι διαχειριστική· αν κάποιος
 * «σφίξει» αυτό το path σε super-admin-only (όπως τους curated καταλόγους δίπλα), κάθε
 * εισαγωγή θα κατέληγε με 10 «λείπει» και **καμία ένδειξη γιατί** — η αποτυχία θα έμοιαζε
 * ακριβώς με τη φυσιολογική κατάσταση «δεν βρέθηκε το αρχείο».
 *
 * Το tenant isolation ελέγχεται και στα τρία σκέλη: cross-tenant → cross_tenant,
 * anonymous → missing_claim. Έχει σημασία εδώ περισσότερο από αλλού, γιατί το path είναι
 * **content-addressed**: το `fileId` προκύπτει από SHA-256 του περιεχομένου, άρα δύο
 * γραφεία με το ΙΔΙΟ δημόσιο διάταγμα παράγουν το ΙΔΙΟ `fileName`. Μόνο το `{companyId}`
 * τμήμα τα κρατά χωριστά — αν πέσει, το ένα γραφείο διαβάζει τα αρχεία του άλλου.
 *
 * @since 2026-07-30 (ADR-736 Φ3 — επίλυση εξωτερικών αναφορών DXF)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'dxf_external_references',
)!;

const COMPANY_ID = SAME_TENANT_COMPANY_ID;
/** `{fileId}.{ext}` — το fileId είναι ντετερμινιστικό από το SHA-256 του περιεχομένου. */
const FILE_NAME = 'file_00000000-0000-4000-8000-000000000001.jpg';

const TEST_PATH = `companies/${COMPANY_ID}/dxf-external-references/${FILE_NAME}`;

describe('dxf-external-references.storage — company_scoped_no_project (ADR-736 Φ3)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initStorageEmulator();
  });

  afterAll(async () => {
    await teardownStorageEmulator(env);
  });

  afterEach(async () => {
    await resetStorageData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Χωρίς προϋπάρχον αρχείο, getMetadata()/delete() γυρίζουν `object-not-found`
        // αντί για `unauthorized` — ένα deny cell θα περνούσε για λάθος λόγο.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});
