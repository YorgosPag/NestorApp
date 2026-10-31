/**
 * ADR-923 §5.6.1 — η έκδοση του Typst ζει σε δύο κόσμους: το `Dockerfile` την εγκαθιστά, ο κώδικας τη ζητά.
 * Αν διαφωνήσουν, κάθε έκδοση στην παραγωγή τελειώνει `engineUnavailable` με πράσινο κτίσμα. Η άγκυρα τα κρατά μαζί.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { TYPST_EXPECTED_VERSION } from '../typst-engine.server';

jest.mock('server-only', () => ({}));

const dockerfile = readFileSync(path.join(process.cwd(), 'Dockerfile'), 'utf8');
const runnerAt = dockerfile.indexOf('AS runner');
const fetchStage = dockerfile.slice(0, runnerAt);
const runnerStage = dockerfile.slice(runnerAt);

describe('η εγκατάσταση του Typst στην εικόνα', () => {
  it('🔑 το Dockerfile εγκαθιστά την έκδοση που ζητά ο κώδικας', () => {
    expect(dockerfile).toContain(`ARG TYPST_VERSION=${TYPST_EXPECTED_VERSION}\n`);
  });

  it('🔒 το αρχείο είναι καρφωμένο με sha256, και η έκδοση δεν γράφεται δεύτερη φορά στο URL', () => {
    expect(fetchStage).toMatch(/ADD --checksum=sha256:[0-9a-f]{64} /);
    expect(fetchStage).toContain('/download/v${TYPST_VERSION}/');
  });

  it('🔴 το κτίσμα ελέγχει αρχιτεκτονική, έκδοση και πραγματικό PDF/A πριν από την κυκλοφορία', () => {
    expect(fetchStage).toContain('test "$(uname -m)" = x86_64');
    expect(fetchStage).toContain('grep -Fq "typst ${TYPST_VERSION} "');
    expect(fetchStage).toContain('--pdf-standard a-2b');
    expect(fetchStage).toContain('test -s /tmp/smoke.pdf');
  });

  it('🔒 ο runner δεν κατεβάζει τίποτα: παίρνει μόνο το εκτελέσιμο και τις άδειες, πριν από την αλλαγή χρήστη', () => {
    expect(runnerStage).not.toMatch(/^ADD /m);
    const binaryCopy = runnerStage.indexOf('COPY --from=typst /typst/typst /usr/local/bin/typst\n');
    expect(binaryCopy).toBeGreaterThan(-1);
    expect(binaryCopy).toBeLessThan(runnerStage.indexOf('USER nextjs'));
    expect(runnerStage).toContain('ENV CATALOG_TYPST_BIN=/usr/local/bin/typst');
  });
});
