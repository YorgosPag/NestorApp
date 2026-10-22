/**
 * 🔴 ΑΓΚΥΡΑ Γ45 — **Η ΓΚΑΛΕΡΙ ΤΗΣ ΠΟΡΤΑΣ ΕΠΑΛΗΘΕΥΣΗΣ ΔΕΙΧΝΕΙ ΚΑΘΕ ΕΤΥΜΗΓΟΡΙΑ ΜΕ ΤΗ ΔΙΚΗ ΤΗΣ ΛΕΞΗ** (ADR-916 Φ-Γ2 Σ6).
 * @related components/handover-protocol-verify/testing/* · πρότυπο `components/handover-invite/__tests__/handover-invite-gallery.test.tsx`
 *
 * Ρωτά **μόνο** όσα δεν ρωτούν οι άλλες άγκυρες (η κρίση = Γ42, η πόρτα = Γ44, το σφραγισμένο PDF = Γ41):
 *   Α — κάθε πάνελ καταλήγει στη **δική του** λέξη, μέσα από τον πραγματικό αναγνώστη PDF + Web Crypto + αποκωδικοποιητή;
 *   Β — «Επαληθευμένο» εμφανίζεται σε **ΕΝΑ** μόνο πάνελ — ποτέ σε γνήσιο-αλλά-παλιό, αβέβαιο ή ξένο;
 *   Γ — κανένα αίτημα δεν φεύγει από τη σελίδα, και ο μεταφορέας επαναφέρεται.
 */

jest.mock('@/lib/api/enterprise-api-client', () => {
  const types = jest.requireActual('@/lib/api/api-client-types');
  return {
    // ⚠️ Αντικείμενο, ΠΟΤΕ read-only mock: η γκαλερί το **μπαλώνει** — αυτή είναι η ραφή που ελέγχουμε.
    apiClient: { get: jest.fn(), post: jest.fn() },
    ApiClientError: types.ApiClientError,
    PUBLIC_REQUEST: types.PUBLIC_REQUEST,
  };
});
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }) }));
jest.mock('@/lib/intl-formatting', () => ({ formatDateTime: (iso: string) => `abs(${iso})` }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import React from 'react';
import { webcrypto } from 'node:crypto';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { apiClient } from '@/lib/api/enterprise-api-client';

import { HandoverProtocolVerifyHarness } from '../testing/HandoverProtocolVerifyHarness';
import { PACKAGE_SCENARIOS, PROTOCOL_CHECK_SCENARIOS, PROTOCOL_RECORD_SCENARIOS } from '../testing/handover-protocol-verify-scenarios';

const SETTLE_TIMEOUT_MS = 15_000;
const panel = (id: string) => screen.getByTestId(`harness-panel-${id}`);
const K = 'handoverVerify';

/** Η λέξη που οφείλει να καταλήξει κάθε πάνελ — γραμμένη εδώ ανεξάρτητα από την όψη. */
const EXPECTED: Readonly<Record<string, string>> = {
  verified: `${K}.verdict.verified.title`,
  superseded: `${K}.verdict.superseded.title`,
  'standing-undetermined': `${K}.verdict.undetermined.title`,
  altered: `${K}.verdict.altered.title`,
  'not-registered': `${K}.verdict.notRegistered.title`,
  'other-protocol': `${K}.verdict.otherProtocol.title`,
  'table-inconsistent': `${K}.inconsistent.title`,
  'no-manifest': `${K}.refused.noManifest.title`,
  'manifest-foreign-schema': `${K}.refused.manifestInvalid.title`,
  'not-pdf': `${K}.refused.notPdf.title`,
  'rate-limited': `${K}.unavailable.rateLimited.title`,
  'registry-unreachable': `${K}.unavailable.unreachable.title`,
  'record-current': `${K}.record.current`,
  'record-superseded': `${K}.record.superseded`,
  'record-undetermined': `${K}.record.undetermined`,
  'record-unknown': `${K}.verdict.notRegistered.title`,
  'record-rate-limited': `${K}.unavailable.rateLimited.title`,
  'package-complete': `${K}.package.complete`,
  'package-renamed-and-extra': `${K}.package.extra.notInProtocol`,
  'package-differs-missing-unchecked': `${K}.package.status.differs`,
};

/**
 * ⚠️ Ο κωδικοποιητής του Node επιστρέφει `Uint8Array` **άλλου realm** — το pdf-lib τον απορρίπτει με `instanceof`.
 * Αντιγραφή στο realm του jsdom: ίδια bytes, σωστός τύπος.
 */
class RealmTextEncoder {
  private readonly inner = new NodeTextEncoder();
  readonly encoding = 'utf-8';
  encode(text: string): Uint8Array {
    return Uint8Array.from(this.inner.encode(text));
  }
}

/** Το ίδιο για το Web Crypto του Node, προς την αντίθετη κατεύθυνση: δέχεται μόνο buffers του **δικού του** realm. */
const realmCrypto = {
  subtle: {
    digest: (algorithm: string, data: ArrayBuffer | ArrayBufferView) =>
      webcrypto.subtle.digest(algorithm, ArrayBuffer.isView(data) ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : Buffer.from(data)),
  },
};

/** Το Node δίνει ό,τι λείπει από το jsdom (Web Crypto · `File.arrayBuffer` · Text codecs) — ο ίδιος κώδικας τρέχει. */
beforeAll(() => {
  const define = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('crypto', realmCrypto);
  define('Blob', NodeBlob);
  define('File', NodeFile);
  define('TextEncoder', RealmTextEncoder);
  define('TextDecoder', NodeTextDecoder);
});

describe('Γ45 — η γκαλερί της πόρτας επαλήθευσης', () => {
  it('🔑 Α0 — κάθε σενάριο έχει δηλωμένη λέξη, και καμία ταυτότητα δύο φορές', () => {
    const all = [...PROTOCOL_CHECK_SCENARIOS, ...PROTOCOL_RECORD_SCENARIOS, ...PACKAGE_SCENARIOS].map((item) => item.id);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('🔴 Α1 + Β1 + Γ1 — κάθε πάνελ στη δική του λέξη · «Επαληθευμένο» σε ΕΝΑ · μηδέν αιτήματα έξω', async () => {
    const realGet = apiClient.get;
    const view = render(<HandoverProtocolVerifyHarness />);
    for (const [id, word] of Object.entries(EXPECTED)) {
      await waitFor(() => expect(panel(id)).toHaveTextContent(word), { timeout: SETTLE_TIMEOUT_MS });
    }
    const verified = Object.keys(EXPECTED).filter((id) => panel(id).textContent?.includes(`${K}.verdict.verified.title`));
    expect(verified).toEqual(['verified']);
    // Ο έλεγχος πακέτου ζει ΜΟΝΟ κάτω από γνήσιο Πρωτόκολλο — εδώ δεν έχει slot, άρα κανένα πάνελ ελέγχου δεν τον δείχνει.
    expect(panel('altered')).not.toHaveTextContent(`${K}.pick.packageTitle`);
    // Το πραγματικό `get` δεν κλήθηκε ΠΟΤΕ: κάθε ερώτηση απαντήθηκε από τον μεταφορέα.
    expect(apiClient.get).not.toBe(realGet);
    expect(realGet).not.toHaveBeenCalled();
    view.unmount();
    // Επαναφορά = ΑΚΡΙΒΩΣ ό,τι υπήρχε (ο ΕΝΑΣ μεταφορέας, άγκυρα Γ1 της γκαλερί πρόσκλησης).
    expect(apiClient.get).toBe(realGet);
  }, 60_000);
});
