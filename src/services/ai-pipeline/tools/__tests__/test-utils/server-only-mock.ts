/**
 * Mock for Next.js `server-only` package.
 * The real package throws an error when imported outside a server context.
 * This mock does nothing — allows handlers to be tested in Jest.
 */
export {};
