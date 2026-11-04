/**
 * Ο ΕΝΑΣ ψεύτικος `next/server` για τα unit tests των routes του `defineRoute` (ADR-603).
 *
 * 🔑 Γιατί υπάρχει: ήταν το ίδιο μπλοκ, αντιγραμμένο σε 14 σουίτες, και **δεν είχε `headers`**. Από τη στιγμή που
 * κάθε απόκριση του factory φεύγει από την ασπίδα (ADR-603 §Ασπίδα — `Cache-Control`, `X-Request-ID`), μια απόκριση
 * χωρίς κεφαλίδες δεν είναι απλώς ελλιπής: είναι ψέμα για το συμβόλαιο. Εδώ οι κεφαλίδες είναι **αληθινές** (`Headers`),
 * και ό,τι περνά στο `init.headers` φτάνει στην απόκριση — όπως στο Next.
 *
 * @example
 * jest.mock('next/server', () =>
 *   jest.requireActual<typeof import('@/test-utils/next-response-json-mock')>('@/test-utils/next-response-json-mock')
 *     .nextServerJsonMock());
 */

export interface MockJsonResponse {
  readonly status: number;
  readonly headers: Headers;
  json(): Promise<unknown>;
}

export function nextServerJsonMock() {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number; headers?: HeadersInit }): MockJsonResponse {
      return { status: init?.status ?? 200, headers: new Headers(init?.headers), json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
}
