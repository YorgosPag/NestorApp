#!/usr/bin/env tsx
/**
 * **FORCE RUN ΜΙΑΣ ΕΡΓΑΣΙΑΣ CRON** — ADR-740 §9 · ADR-777 §8.69.14
 *
 * Τρέχει **μία** εργασία του `CRON_SCHEDULE` τώρα, **μέσα από τον ίδιο executor** με το ρολόι
 * (lease + Sentry monitor + κατάσταση, σημασμένη `manual`). Το ιδίωμα του Google Cloud Scheduler
 * («Force run») και του `kubectl create job --from=cronjob/<name>`: ίδιο περιβάλλον, ίδιοι φύλακες.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ
 * ═══════════════════════════════════════════════════════════════════════════
 *   npm run cron:run -- <slug>                                  # τοπικός dev server
 *   npm run cron:run -- <slug> --base-url=https://nestorconstruct.gr
 *
 * 🔑 **HTTP προς τον server, όχι εκτέλεση εδώ**: η εργασία τρέχει στο περιβάλλον που κατέχει τα
 *    μυστικά και τον κώδικα που **σερβίρεται** — ποτέ τοπικός κώδικας πάνω στην κοινή βάση από
 *    λάθος. Το μυστικό (`CRON_SECRET`) έρχεται από το κέλυφος ή το `.env.local`.
 *
 * ⚠️ **Ρητό user-agent `nestor-scheduler/manual`**: το `curl`/`wget` τρώνε `403` από το bot-block του
 *    `middleware.ts` **πριν** τον handler — σφάλμα που μοιάζει με «λάθος μυστικό» και δεν είναι. Το
 *    `/api/cron` **δεν** ανοίγει στο `isMachineEndpoint` (ρητή απόφαση ADR-740).
 *
 * 🔒 Το `path` είναι `/api/cron/<slug>` — εγγυημένο από το `cron-route-contract.test.ts` (slug =
 *    τελευταίο τμήμα του path). Γι' αυτό το script **δεν** φορτώνει καθόλου κώδικα εφαρμογής.
 */

import { loadEnvLocal } from '../_shared/loadEnvLocal';

const USER_AGENT = 'nestor-scheduler/manual';
const DEFAULT_BASE_URL = 'http://localhost:3000';
/** Η μακρύτερη εργασία (backup) δηλώνει `maxRuntimeMinutes: 45`. */
const REQUEST_TIMEOUT_MS = 50 * 60_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Το χτύπημα ρολογιού δεν είναι εργασία — τρέχει ό,τι οφείλεται, όχι «αυτό». */
const DISPATCHER_SLUG = 'dispatch';
const USAGE = 'Χρήση: npm run cron:run -- <slug> [--base-url=http://localhost:3000]';

interface CronRunArgs {
  readonly slug: string;
  readonly baseUrl: string;
}

type ResponseBody = Readonly<Record<string, unknown>>;

function parseArgs(argv: readonly string[]): CronRunArgs {
  const slug = argv.find((arg) => !arg.startsWith('--')) ?? '';
  const baseUrlArg = argv.find((arg) => arg.startsWith('--base-url='));
  if (!SLUG_PATTERN.test(slug) || slug === DISPATCHER_SLUG) throw new Error(USAGE);

  const baseUrl = (baseUrlArg ? baseUrlArg.slice('--base-url='.length) : DEFAULT_BASE_URL).replace(/\/+$/, '');
  return { slug, baseUrl };
}

function cronSecret(): string {
  const secret = process.env.CRON_SECRET ?? loadEnvLocal().CRON_SECRET;
  if (!secret) throw new Error('Λείπει το CRON_SECRET (κέλυφος ή .env.local)');
  return secret;
}

async function readBody(response: Response): Promise<ResponseBody> {
  try {
    const parsed: unknown = await response.json();
    return parsed !== null && typeof parsed === 'object' ? (parsed as ResponseBody) : {};
  } catch {
    return {};
  }
}

/** Εξήγηση για τις εκβάσεις που μοιάζουν με κάτι άλλο απ' ό,τι είναι. */
function explain(status: number, body: ResponseBody): string | null {
  if (body.authorized === false) return '✖ Το μυστικό ΔΕΝ έγινε δεκτό — απάντησε το probe υγείας, καμία εργασία δεν έτρεξε.';
  if (status === 403) return '✖ 403 από το middleware (bot-block) — ΔΕΝ είναι λάθος μυστικό.';
  if (status === 409) return `⏸ Η εργασία τρέχει ήδη (lease έως ${String(body.heldUntil)}) — δεν ξεκίνησε δεύτερη εκτέλεση.`;
  if (status === 404) return '✖ Άγνωστη εργασία ή route.';
  return null;
}

async function main(): Promise<void> {
  const { slug, baseUrl } = parseArgs(process.argv.slice(2));
  const url = `${baseUrl}/api/cron/${slug}`;
  console.log(`▶ force run «${slug}» → ${url}`);

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${cronSecret()}`, 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = await readBody(response);

  console.log(`HTTP ${response.status}`);
  console.log(JSON.stringify(body, null, 2));
  const note = explain(response.status, body);
  if (note) console.error(note);

  process.exitCode = response.ok && body.ok === true && body.authorized !== false ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
