/**
 * @fileoverview **ΤΙ ΑΠΑΝΤΗΣΕ ΤΟ ΓΕΜΗ — ΜΕ ΦΡΟΥΡΟ, ΠΟΤΕ ΜΕ `as`** — ADR-841 §7 Α23.
 * @module services/company-registry/gemi-opendata-parse
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΙΣΟΔΟΙ, ΕΝΑ ΣΧΗΜΑ ΕΞΟΔΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **Το σύρμα** του ΓΕΜΗ Open Data — `Company` και `CompanyStatus` του OpenAPI 2.0
 *    (`https://opendata-api.businessportal.gr/api-docs`, κατεβασμένο ζωντανά 2026-09-14).
 * 2. **Το αποθηκευμένο αντίγραφο** στο `company_registry_records`.
 *
 * Και οι δύο καταλήγουν στο **ίδιο** `RegistryCompanyRecord` μέσα από το **ίδιο**
 * {@link assembleRecord}: αν κάποιος αύριο προσθέσει πεδίο, δεν μπορεί να το γεμίζει η μία
 * πλευρά και να το ξεχνά η άλλη.
 *
 * ⛔ **Ό,τι δεν χρειαζόμαστε δεν διαβάζεται καν**: `persons` · `capital` · `stocks` · `afm` ·
 * `objective` · `email` · `url`. Ο φρουρός **απαριθμεί** πεδία — δεν αντιγράφει αντικείμενο.
 *
 * ⚠️ **Αποθηκευμένο που δεν περνά τον φρουρό ⇒ `null`**, και ο αναγνώστης το λέει
 * `unavailable`, **ποτέ** «δεν ρωτήθηκε»: το έγγραφο υπάρχει, απλώς το αντίγραφό μας χάλασε
 * (ίδιο δόγμα με το `occupation-classification.reader`).
 *
 * **Layering**: καθαρή — καμία εισαγωγή I/O.
 */

import { canonicalGemiNumber } from '@/lib/company/gemi-number';
import {
  GEMI_REGISTRY_SOURCE,
  type RegistryActivity,
  type RegistryCode,
  type RegistryCompanyRecord,
  type RegistrySeat,
  type RegistryStatus,
} from '@/types/company-registry';

type Loose = Readonly<Record<string, unknown>>;

/** Κατάλογος καταστάσεων: κωδικός → ενεργή. */
export type StatusCatalog = ReadonlyMap<string, boolean>;

/** Πώς λέγονται τα ίδια πράγματα στο σύρμα και στο αντίγραφό μας. */
interface Dialect {
  readonly postalCode: 'zipCode' | 'postalCode';
  readonly label: 'descr' | 'label';
}

const WIRE: Dialect = { postalCode: 'zipCode', label: 'descr' };
const STORED: Dialect = { postalCode: 'postalCode', label: 'label' };

const ACTIVITIES: readonly RegistryActivity[] = ['active', 'inactive', 'unknown'];

function isLoose(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function texts(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((entry): entry is string => entry !== null);
}

function numberLike(value: unknown): string | number | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function codeOf(value: unknown, dialect: Dialect): RegistryCode | null {
  if (!isLoose(value)) return null;
  const id = numberLike(value.id);
  const label = text(value[dialect.label]);
  const idText = id === null ? '' : String(id).trim();
  return idText !== '' && label !== null ? { id: idText, label } : null;
}

function seatOf(source: Loose, dialect: Dialect): RegistrySeat {
  return {
    street: text(source.street),
    streetNumber: text(source.streetNumber),
    postalCode: text(source[dialect.postalCode]),
    city: text(source.city),
    municipality: codeOf(source.municipality, dialect),
  };
}

interface RecordParts {
  readonly registrationNumber: string;
  readonly legalName: string;
  readonly legalNamesLatin: unknown;
  readonly distinctiveTitles: unknown;
  readonly distinctiveTitlesLatin: unknown;
  readonly legalForm: RegistryCode | null;
  readonly status: RegistryStatus;
  readonly seat: RegistrySeat;
  readonly isBranch: unknown;
  readonly selfRegistered: unknown;
}

/** Ο **ένας** κατασκευαστής του σχήματος — και για το σύρμα και για το αντίγραφο. */
function assembleRecord(parts: RecordParts): RegistryCompanyRecord {
  return {
    source: GEMI_REGISTRY_SOURCE,
    registrationNumber: parts.registrationNumber,
    legalName: parts.legalName,
    legalNamesLatin: texts(parts.legalNamesLatin),
    distinctiveTitles: texts(parts.distinctiveTitles),
    distinctiveTitlesLatin: texts(parts.distinctiveTitlesLatin),
    legalForm: parts.legalForm,
    status: parts.status,
    seat: parts.seat,
    isBranch: parts.isBranch === true,
    // Απουσία ⇒ «πλήρη»: η προεπιλογή του ίδιου του OpenAPI είναι `true`.
    selfRegistered: parts.selfRegistered !== false,
  };
}

/**
 * Ο κατάλογος `/metadata/companyStatuses` — **`null` αν δεν δίνει ούτε μία χρήσιμη γραμμή**,
 * ώστε ένας άδειος κατάλογος να μη διαβαστεί ως «καμία κατάσταση δεν είναι ενεργή».
 */
export function parseGemiStatusCatalog(payload: unknown): StatusCatalog | null {
  if (!Array.isArray(payload)) return null;
  const catalog = new Map<string, boolean>();
  for (const entry of payload) {
    const code = codeOf(entry, WIRE);
    if (code !== null && isLoose(entry) && typeof entry.isActive === 'boolean') {
      catalog.set(code.id, entry.isActive);
    }
  }
  return catalog.size > 0 ? catalog : null;
}

function activityOf(code: RegistryCode | null, catalog: StatusCatalog | null): RegistryActivity {
  if (code === null || catalog === null) return 'unknown';
  const active = catalog.get(code.id);
  if (active === undefined) return 'unknown';
  return active ? 'active' : 'inactive';
}

/** Το σώμα του `GET /companies/{arGemi}` — `null` αν λείπει αριθμός ή επωνυμία. */
export function parseGemiCompany(
  payload: unknown,
  catalog: StatusCatalog | null,
): RegistryCompanyRecord | null {
  if (!isLoose(payload)) return null;
  const registrationNumber = canonicalGemiNumber(numberLike(payload.arGemi));
  const legalName = text(payload.coNameEl);
  if (registrationNumber === null || legalName === null) return null;

  const statusCode = codeOf(payload.status, WIRE);
  return assembleRecord({
    registrationNumber,
    legalName,
    legalNamesLatin: payload.coNamesEn,
    distinctiveTitles: payload.coTitlesEl,
    distinctiveTitlesLatin: payload.coTitlesEn,
    legalForm: codeOf(payload.legalType, WIRE),
    status: { code: statusCode, activity: activityOf(statusCode, catalog) },
    seat: seatOf(payload, WIRE),
    isBranch: payload.isBranch,
    selfRegistered: payload.autoRegistered,
  });
}

/** Το αποθηκευμένο αντίγραφο — `null` αν δεν είναι **ακριβώς** δικό μας σχήμα. */
export function parseStoredRegistryRecord(raw: unknown): RegistryCompanyRecord | null {
  if (!isLoose(raw) || raw.source !== GEMI_REGISTRY_SOURCE) return null;
  const registrationNumber = canonicalGemiNumber(numberLike(raw.registrationNumber));
  const legalName = text(raw.legalName);
  const status = isLoose(raw.status) ? raw.status : null;
  const activity = ACTIVITIES.find((candidate) => candidate === status?.activity);
  if (registrationNumber === null || legalName === null || status === null || !activity) return null;

  return assembleRecord({
    registrationNumber,
    legalName,
    legalNamesLatin: raw.legalNamesLatin,
    distinctiveTitles: raw.distinctiveTitles,
    distinctiveTitlesLatin: raw.distinctiveTitlesLatin,
    legalForm: codeOf(raw.legalForm, STORED),
    status: { code: codeOf(status.code, STORED), activity },
    seat: seatOf(isLoose(raw.seat) ? raw.seat : {}, STORED),
    isBranch: raw.isBranch,
    selfRegistered: raw.selfRegistered,
  });
}
