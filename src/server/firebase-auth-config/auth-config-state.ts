/**
 * @fileoverview **ΔΗΛΩΜΕΝΟ ΕΝΑΝΤΙ ΖΩΝΤΑΝΟΥ** — η καθαρή σύγκριση της ρύθμισης Firebase Auth (ADR-851).
 * @module server/firebase-auth-config/auth-config-state
 *
 * **Καθαρό**: κανένα δίκτυο, κανένα ρολόι, καμία Firebase. Το I/O ζει στο
 * `identity-toolkit-config.ts`, η σύνθεση στο `auth-config-audit.ts`. Εδώ ζει μόνο η
 * απάντηση στο *«συμφωνεί η κονσόλα με το git;»* — ώστε να τη ρωτούν οι άγκυρες.
 *
 * 🔒 **Κανένα μυστικό δεν διαβάζεται**: οι διαδρομές είναι κλειστό σύνολο και καμία δεν
 * αγγίζει `smtp` · `client.apiKey` · `signIn.hashConfig`. Ό,τι δεν δηλώνεται δεν
 * διαβάζεται, και ό,τι δεν διαβάζεται δεν τυπώνεται.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΓΡΑΦΕΤΑΙ ΜΕ ΚΩΔΙΚΑ ΚΑΙ ΤΙ ΟΧΙ — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΠΑΡΑΓΩΓΗ, 2026-09-11
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Διαδρομή | `projects.updateConfig` |
 * |---|---|
 * | `authorizedDomains` · `notification.defaultLocale` · `emailPrivacyConfig.*` | ✅ γράφεται |
 * | `notification.sendEmail.callbackUri` | ❌ `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` |
 * | `notification.sendEmail.*Template` | ❌ `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` |
 *
 * Και το PATCH που περιέχει **έστω μία** απαγορευμένη διαδρομή απορρίπτεται **ολόκληρο**.
 * ⇒ Οι διαδρομές μόνο-κονσόλας **κρίνονται** (απόκλιση = εύρημα, ημερησίως) αλλά **ποτέ** δεν
 * μπαίνουν σε PATCH — αλλιώς θα κρατούσαν όμηρο κάθε άλλη διόρθωση.
 */

import {
  FIREBASE_AUTH_DEFAULT_LOCALE,
  FIREBASE_AUTH_EMAIL_ENUMERATION_PROTECTION,
  FIREBASE_AUTH_EXTRA_AUTHORIZED_DOMAINS,
  FIREBASE_AUTH_SENDER,
} from '@/config/firebase-auth-config';
import { joinOrigin } from '@/lib/http/public-origin';
import { AUTH_ROUTES } from '@/lib/routes/authRoutes';

/**
 * **Τα πρότυπα που στέλνει ΑΚΟΜΗ η Firebase — και μόνο αυτά κρίνονται.**
 *
 * 🔑 Επαναφορά κωδικού και επιβεβαίωση email φεύγουν από το **δικό μας** mailer, στη γλώσσα
 * του παραλήπτη (ADR-851 Φ2)· τα πρότυπά τους στην κονσόλα **δεν τα διαβάζει κανείς**.
 * Μένει η ειδοποίηση «το email σας άλλαξε» προς την **παλιά** διεύθυνση, που τη στέλνει η
 * Firebase τη στιγμή που εφαρμόζεται ο κωδικός — καμία δική μας γραμμή δεν τρέχει τότε.
 */
export const JUDGED_TEMPLATE_KINDS = ['changeEmail'] as const;
export type JudgedTemplateKind = (typeof JUDGED_TEMPLATE_KINDS)[number];

/** Ένα πρότυπο όπως το δηλώνουμε — **ολόκληρο**, όπως το επικολλά ο άνθρωπος στην κονσόλα. */
export interface DeclaredTemplate {
  readonly subject: string;
  readonly body: string;
  readonly bodyFormat: 'HTML';
  readonly senderDisplayName: string;
  readonly senderLocalPart: string;
  readonly replyTo: string;
}

export interface DesiredAuthConfig {
  readonly enableImprovedEmailPrivacy: boolean;
  readonly defaultLocale: string;
  readonly callbackUri: string;
  readonly authorizedDomains: readonly string[];
  readonly templates: Readonly<Record<JudgedTemplateKind, DeclaredTemplate>>;
}

export type DesiredAuthConfigOutcome =
  | { readonly kind: 'ready'; readonly desired: DesiredAuthConfig }
  /** Χωρίς δημόσια διεύθυνση **δεν κρίνεται** τίποτα — ποτέ «πράσινο» πάνω σε μαντεψιά. */
  | { readonly kind: 'refused'; readonly reason: 'no-public-origin' };

/** Οι διαδρομές στο αντικείμενο της Identity Toolkit Admin v2 `Config`. */
export const SCALAR_PATHS = {
  enableImprovedEmailPrivacy: 'emailPrivacyConfig.enableImprovedEmailPrivacy',
  defaultLocale: 'notification.defaultLocale',
  callbackUri: 'notification.sendEmail.callbackUri',
  authorizedDomains: 'authorizedDomains',
} as const;

export const TEMPLATE_PATHS: Readonly<Record<JudgedTemplateKind, string>> = {
  changeEmail: 'notification.sendEmail.changeEmailTemplate',
};

/** **Διαδρομές που η Google ΔΕΝ δέχεται μέσω API** — δες τον πίνακα της κεφαλίδας. */
export const CONSOLE_ONLY_PATHS: readonly string[] = [SCALAR_PATHS.callbackUri, ...Object.values(TEMPLATE_PATHS)];

/**
 * **Ό,τι ΔΕΝ μπορεί να κριθεί από εδώ** — λέγεται, δεν σιωπάται («0 = κανείς δεν κοίταξε»).
 */
export const NOT_JUDGED: readonly string[] = [
  'Verify before change template (console-only, not in the API; kept un-customised so Firebase localises it by languageCode)',
  'resetPassword / verifyEmail templates (no longer sent by Firebase — ADR-851 Φ2 own mailer)',
];

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

/** **Τι πρέπει να ισχύει** — παράγεται από το SSoT της δημόσιας διεύθυνσης και το project. */
export function buildDesiredAuthConfig(input: {
  readonly publicOrigin: string | null;
  readonly projectId: string;
  readonly templates: Readonly<Record<JudgedTemplateKind, { readonly subject: string; readonly body: string }>>;
}): DesiredAuthConfigOutcome {
  if (input.publicOrigin === null) return { kind: 'refused', reason: 'no-public-origin' };

  const templates = Object.fromEntries(
    JUDGED_TEMPLATE_KINDS.map((kind) => [
      kind,
      { ...input.templates[kind], bodyFormat: 'HTML' as const, ...FIREBASE_AUTH_SENDER },
    ]),
  ) as Record<JudgedTemplateKind, DeclaredTemplate>;

  return {
    kind: 'ready',
    desired: {
      enableImprovedEmailPrivacy: FIREBASE_AUTH_EMAIL_ENUMERATION_PROTECTION,
      defaultLocale: FIREBASE_AUTH_DEFAULT_LOCALE,
      callbackUri: joinOrigin(input.publicOrigin, AUTH_ROUTES.action),
      authorizedDomains: uniqueSorted([
        ...FIREBASE_AUTH_EXTRA_AUTHORIZED_DOMAINS,
        `${input.projectId}.firebaseapp.com`,
        `${input.projectId}.web.app`,
        new URL(input.publicOrigin).hostname,
      ]),
      templates,
    },
  };
}

/** Μία απόκλιση — **περιγραφές**, ποτέ ολόκληρα σώματα ή τιμές που δεν δηλώσαμε. */
export interface AuthConfigDrift {
  readonly path: string;
  readonly expected: string;
  readonly actual: string;
}

/** Χωρίζει τις αποκλίσεις σε όσες γράφει ο κώδικας και όσες διορθώνει άνθρωπος στην κονσόλα. */
export function partitionDrifts(drifts: readonly AuthConfigDrift[]): {
  readonly applicable: readonly AuthConfigDrift[];
  readonly consoleOnly: readonly AuthConfigDrift[];
} {
  return {
    applicable: drifts.filter((drift) => !CONSOLE_ONLY_PATHS.includes(drift.path)),
    consoleOnly: drifts.filter((drift) => CONSOLE_ONLY_PATHS.includes(drift.path)),
  };
}

/** Ανάγνωση διαδρομής σε άγνωστο αντικείμενο — `undefined` αν λείπει οποιοδήποτε σκαλί. */
export function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[key] : undefined),
    source,
  );
}

/** Τα κενά ενός σώματος HTML δεν είναι περιεχόμενο — η Firebase μπορεί να τα κανονικοποιεί. */
function normalizeBody(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function describeTemplate(template: unknown): string {
  const subject = readPath(template, 'subject');
  const body = readPath(template, 'body');
  const sender = readPath(template, 'senderDisplayName');
  return `subject=${JSON.stringify(subject ?? null)} sender=${JSON.stringify(sender ?? null)} `
    + `body=${typeof body === 'string' ? `${body.length} chars` : 'none'}`;
}

function templateMatches(declared: DeclaredTemplate, live: unknown): boolean {
  return readPath(live, 'subject') === declared.subject
    && normalizeBody(readPath(live, 'body')) === normalizeBody(declared.body)
    && readPath(live, 'bodyFormat') === declared.bodyFormat
    && readPath(live, 'senderDisplayName') === declared.senderDisplayName
    && readPath(live, 'senderLocalPart') === declared.senderLocalPart
    && readPath(live, 'replyTo') === declared.replyTo;
}

function scalarDrifts(desired: DesiredAuthConfig, live: unknown): AuthConfigDrift[] {
  const drifts: AuthConfigDrift[] = [];
  const scalars = [
    [SCALAR_PATHS.enableImprovedEmailPrivacy, desired.enableImprovedEmailPrivacy],
    [SCALAR_PATHS.defaultLocale, desired.defaultLocale],
    [SCALAR_PATHS.callbackUri, desired.callbackUri],
  ] as const;
  for (const [path, expected] of scalars) {
    const actual = readPath(live, path);
    if (actual !== expected) drifts.push({ path, expected: JSON.stringify(expected), actual: JSON.stringify(actual ?? null) });
  }

  const liveDomains = readPath(live, SCALAR_PATHS.authorizedDomains);
  const actualDomains = Array.isArray(liveDomains) ? uniqueSorted(liveDomains.map(String)) : [];
  if (JSON.stringify(actualDomains) !== JSON.stringify(desired.authorizedDomains)) {
    drifts.push({
      path: SCALAR_PATHS.authorizedDomains,
      expected: desired.authorizedDomains.join(', '),
      actual: actualDomains.join(', '),
    });
  }
  return drifts;
}

/** **Πού διαφωνεί η κονσόλα με το git** — κενός πίνακας = καμία απόκλιση στα δηλωμένα. */
export function diffAuthConfig(desired: DesiredAuthConfig, live: unknown): AuthConfigDrift[] {
  const templateDrifts = JUDGED_TEMPLATE_KINDS.flatMap((kind) => {
    const liveTemplate = readPath(live, TEMPLATE_PATHS[kind]);
    return templateMatches(desired.templates[kind], liveTemplate)
      ? []
      : [{ path: TEMPLATE_PATHS[kind], expected: describeTemplate(desired.templates[kind]), actual: describeTemplate(liveTemplate) }];
  });
  return [...scalarDrifts(desired, live), ...templateDrifts];
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (typeof node[key] !== 'object' || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]] = value;
}

function desiredValueAt(desired: DesiredAuthConfig, path: string): unknown {
  if (path === SCALAR_PATHS.enableImprovedEmailPrivacy) return desired.enableImprovedEmailPrivacy;
  if (path === SCALAR_PATHS.defaultLocale) return desired.defaultLocale;
  if (path === SCALAR_PATHS.authorizedDomains) return desired.authorizedDomains;
  throw new Error(`Undeclared Firebase Auth config path: ${path}`);
}

/**
 * **Το PATCH — ΜΟΝΟ ό,τι απέκλινε ΚΑΙ γράφεται.** Το `updateMask` απαριθμεί **ακριβώς** τις
 * διαδρομές του σώματος: ό,τι δεν δηλώσαμε δεν μπορεί να γραφτεί, ούτε κατά λάθος — και
 * διαδρομή μόνο-κονσόλας **αρνείται** εδώ, πριν φτάσει στη Google.
 */
export function patchForDrifts(
  desired: DesiredAuthConfig,
  drifts: readonly AuthConfigDrift[],
): { readonly body: Record<string, unknown>; readonly updateMask: string } {
  const consoleOnly = drifts.find((drift) => CONSOLE_ONLY_PATHS.includes(drift.path));
  if (consoleOnly !== undefined) {
    throw new Error(`Console-only Firebase Auth config path cannot be patched: ${consoleOnly.path}`);
  }
  const body: Record<string, unknown> = {};
  for (const drift of drifts) setPath(body, drift.path, desiredValueAt(desired, drift.path));
  return { body, updateMask: drifts.map((drift) => drift.path).join(',') };
}
