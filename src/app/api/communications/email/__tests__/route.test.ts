/**
 * `POST /api/communications/email` — στέλνει μέσω της ΕΝΑ αλυσίδας παρόχων (ADR-876 §5.8 Σ22).
 *
 * Η αλυσίδα (`sendThroughChain`) είναι η **πραγματική**· μόνο οι κρίκοι είναι ψεύτικοι, ώστε το
 * test να κρίνει τι κάνει το route με κάθε κατάληξη (`delivered` / `all-failed` / `no-provider`).
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: <T>(h: T) => h,
}));

var authCtx = { uid: 'user_1', companyId: 'comp_a', isAuthenticated: true as const };
var mockLogAuditEvent = jest.fn(async () => undefined);

jest.mock('@/lib/auth', () => ({
  withAuth: (callback: (...args: unknown[]) => Promise<unknown>) =>
    async (request: unknown) => callback(request, authCtx, { cache: true }),
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...(args as [])),
  extractRequestMetadata: () => ({}),
}));

var mockLoggerError = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
  }),
}));

jest.mock('@/server/admin/admin-guards', () => ({}));

var mockRecordSentEmail = jest.fn(async () => 'msg_1');
jest.mock('../record-sent-email', () => ({
  recordSentEmail: (...args: unknown[]) => mockRecordSentEmail(...(args as [])),
}));

var mockSend = jest.fn();
var providerConfigured = true;
jest.mock('@/server/comms/email-providers', () => ({
  defaultEmailChain: () => [{ name: 'mailgun', configured: providerConfigured, send: mockSend }],
}));

import { POST } from '../route';

type Handler = (request: unknown) => Promise<{ status: number; json: () => Promise<Record<string, unknown>> }>;
const post = POST as unknown as Handler;

const BODY = {
  to: 'grafeio-b@example.test',
  subject: 'Θέμα',
  message: 'Κείμενο',
  templateId: 'custom',
  leadId: 'opp_1',
  contactId: 'cont_1',
};

function request(body: Record<string, unknown> = BODY) {
  return { json: async () => body, headers: new Map() };
}

describe('POST /api/communications/email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    providerConfigured = true;
    mockSend.mockResolvedValue({ kind: 'delivered', messageId: '<mg_42@mailgun>' });
  });

  it('στέλνει μέσω της αλυσίδας και γράφει το ιστορικό με το id του παρόχου', async () => {
    const response = await post(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'sent', messageId: '<mg_42@mailgun>' });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: BODY.to, subject: BODY.subject, text: BODY.message,
    }));
    expect(mockRecordSentEmail).toHaveBeenCalledWith(expect.objectContaining({
      auth: authCtx, contactId: 'cont_1', opportunityId: 'opp_1', providerMessageId: '<mg_42@mailgun>',
    }));
  });

  it('δεν γράφει `From:` με το χέρι — το αφήνει στη ρίζα αποστολέα (ADR-857 Φ9)', async () => {
    await post(request());
    expect(mockSend.mock.calls[0][0]).not.toHaveProperty('from');
  });

  it('αποτυχία παρόχου ⇒ 502, καμία εγγραφή ιστορικού ή audit', async () => {
    mockSend.mockResolvedValue({ kind: 'rejected', error: 'Mailgun API 401' });

    const response = await post(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ error: 'mailgun: Mailgun API 401' });
    expect(mockRecordSentEmail).not.toHaveBeenCalled();
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('κανένας ρυθμισμένος πάροχος ⇒ 503, καμία εγγραφή', async () => {
    providerConfigured = false;

    const response = await post(request());

    expect(response.status).toBe(503);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockRecordSentEmail).not.toHaveBeenCalled();
  });

  it('χωρίς contactId στέλνει αλλά δεν γράφει ιστορικό επαφής', async () => {
    const { contactId: _omit, ...withoutContact } = BODY;

    const response = await post(request(withoutContact));

    expect(response.status).toBe(200);
    expect(mockRecordSentEmail).not.toHaveBeenCalled();
  });

  it('ελλιπή πεδία ⇒ 400, χωρίς αποστολή', async () => {
    const response = await post(request({ to: 'a@example.test' }));

    expect(response.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('απρόβλεπτο σφάλμα ⇒ 500, και το log κρατά το ΜΗΝΥΜΑ, όχι `[object Object]`', async () => {
    const broken = { json: async () => { throw new Error('bad json'); }, headers: new Map() };

    const response = await post(broken);

    expect(response.status).toBe(500);
    expect(mockLoggerError).toHaveBeenCalledWith('Error in email API', { error: 'bad json' });
  });
});
