/**
 * =============================================================================
 * Profession Bridge Config — Project Role → ESCO Occupation Mapping
 * =============================================================================
 *
 * 1:1 mapping from 7 project engineer roles to ESCO occupations.
 * URIs and labels verified against the EU ESCO API (2026-04-04).
 *
 * 5 roles have exact ESCO matches (with URI).
 * 2 roles (energy_inspector, supervising_engineer) are Greek TEE-specific
 * and have no exact ESCO equivalent — hardcoded without URI.
 *
 * Since 2026-08-01 this module owns the bridge in **both** directions: the forward
 * `role → profession` lookup and the reverse `profession text → role` resolver that reads
 * what a surveyor typed into a DXF titleblock (ADR-745 §6.4, gap G1). One module, one
 * vocabulary — a second file would be a sibling clone of the same table (N.12, N.18).
 *
 * @module config/profession-bridge.config
 * @enterprise ADR-282 - Google Derived Roles Pattern
 */

import { ENTITY_ASSOCIATION_ROLES, type ProjectRole } from '@/types/entity-associations';
import { containsWordSequence, splitIntoWords } from '@/utils/greek-text';

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionBridgeEntry {
  /** Profession label as displayed (Greek, capitalized) */
  readonly profession: string;
  /** ESCO preferred label (lowercase, as in EU taxonomy) — null if no match */
  readonly escoLabel: string;
  /** ISCO-08 code (with sub-code where available) */
  readonly iscoCode: string;
  /** ESCO occupation URI — null if no exact ESCO match */
  readonly escoUri: string | null;
}

// ============================================================================
// VERIFIED MAPPING (EU ESCO API, 2026-04-04)
// ============================================================================

export const PROJECT_ROLE_BRIDGE: Readonly<Record<ProjectRole, ProfessionBridgeEntry>> = {
  // ── ESCO-verified (5/7) ──────────────────────────────────────────────
  architect: {
    profession: 'Αρχιτέκτονας',
    escoLabel: 'αρχιτέκτονας',
    iscoCode: '2161',
    escoUri: 'http://data.europa.eu/esco/occupation/8c3f536e-ba66-4321-ba40-363dc39f129b',
  },
  structural_engineer: {
    profession: 'Πολιτικός Μηχανικός',
    escoLabel: 'πολιτικός μηχανικός',
    iscoCode: '2142',
    escoUri: 'http://data.europa.eu/esco/occupation/d7d986e1-7333-431b-9719-0c5c6939e360',
  },
  electrical_engineer: {
    profession: 'Ηλεκτρολόγος Μηχανικός',
    escoLabel: 'ηλεκτρολόγος μηχανικός',
    iscoCode: '2151',
    escoUri: 'http://data.europa.eu/esco/occupation/86ca306c-ab99-420a-9e2a-aa73c5c4de22',
  },
  mechanical_engineer: {
    profession: 'Μηχανολόγος Μηχανικός',
    escoLabel: 'μηχανολόγος μηχανικός',
    iscoCode: '2144',
    escoUri: 'http://data.europa.eu/esco/occupation/579254cf-6d69-4889-9000-9c79dc568644',
  },
  surveyor: {
    profession: 'Τοπογράφος Μηχανικός',
    escoLabel: 'αγρονόμος τοπογράφος μηχανικός',
    iscoCode: '2165',
    escoUri: 'http://data.europa.eu/esco/occupation/d8e502b4-1be6-4d10-a224-151688f8f0c8',
  },

  // ── Hardcoded — no exact ESCO match (2/7) ────────────────────────────
  energy_inspector: {
    profession: 'Ενεργειακός Επιθεωρητής',
    escoLabel: 'Ενεργειακός Επιθεωρητής',
    iscoCode: '2143',
    escoUri: null,
  },
  supervising_engineer: {
    profession: 'Επιβλέπων Μηχανικός',
    escoLabel: 'Επιβλέπων Μηχανικός',
    iscoCode: '2142',
    escoUri: null,
  },
};

// ============================================================================
// FORWARD DIRECTION — role → profession
// ============================================================================

/**
 * Lookup by arbitrary string.
 *
 * A `Map` rather than indexing the record: callers hand this function whatever role string
 * a document happens to carry, and `PROJECT_ROLE_BRIDGE['__proto__']` would answer with
 * `Object.prototype` — a truthy value that `?? null` never sees. A `Map` has no inherited
 * keys, so an unknown role is simply unknown.
 */
const BRIDGE_LOOKUP: ReadonlyMap<string, ProfessionBridgeEntry> = new Map(
  Object.entries(PROJECT_ROLE_BRIDGE),
);

/**
 * Returns the bridge entry for a given project role, or null.
 */
export function getBridgeEntry(role: string): ProfessionBridgeEntry | null {
  return BRIDGE_LOOKUP.get(role) ?? null;
}

// ============================================================================
// REVERSE DIRECTION — profession text → role (ADR-745 §6.4, gap G1)
// ============================================================================

/** One spelling under which a role may appear in free text, in comparison form. */
interface ProfessionAlias {
  readonly role: ProjectRole;
  readonly words: readonly string[];
}

/**
 * Compiles every spelling of every role **once**, at module load.
 *
 * Both fields count, and identical spellings are folded so one role never answers twice for
 * the same words (`architect`, whose two fields differ only in case).
 *
 * ⚠️ **Measured 2026-08-01: reading `escoLabel` changes no outcome today.** Under containment
 * the shorter phrase matches wherever the longer one does, and every current ESCO label
 * either equals its `profession` or contains it — «αγρονόμος **τοπογράφος μηχανικός**». The
 * field is kept as insurance for the first entry whose ESCO label is a genuinely different
 * phrase (say «μηχανικός χημικών διεργασιών» beside «Χημικός Μηχανικός»), and the invariant
 * that makes it redundant is locked by a test that turns red the day it breaks.
 */
function compileProfessionAliases(): readonly ProfessionAlias[] {
  const aliases: ProfessionAlias[] = [];
  for (const role of ENTITY_ASSOCIATION_ROLES.project) {
    const entry = getBridgeEntry(role);
    if (!entry) continue;

    const seen = new Set<string>();
    for (const spelling of [entry.profession, entry.escoLabel]) {
      const words = splitIntoWords(spelling).map((word) => word.normalized);
      const key = words.join(' ');
      if (words.length === 0 || seen.has(key)) continue;
      seen.add(key);
      aliases.push({ role, words });
    }
  }
  return aliases;
}

const PROFESSION_ALIASES = compileProfessionAliases();

/**
 * Every role whose name occurs in `text`, in bridge declaration order.
 *
 * **Containment, not equality.** «ΑΓΡΟΝΟΜΟΣ ΤΟΠΟΓΡΑΦΟΣ ΜΗΧΑΝΙΚΟΣ Α.Π.Θ.» carries the
 * institution that awarded the degree, and the next drawing will carry `Ε.Μ.Π.`, `Δ.Π.Θ.`,
 * `Α.Τ.Ε.Ι.`, `M.Sc.` or a title none of us has met yet. Stripping those would mean owning
 * a list of every Greek school and academic rank — a list that is wrong the day it is
 * written. Asking instead whether the role's own words are *present* makes the suffix
 * irrelevant by construction: it is simply a word the role never claimed.
 *
 * The words must be **adjacent**, which is what stops «ΠΟΛΙΤΙΚΟΣ ΥΠΑΛΛΗΛΟΣ ΚΑΙ ΜΗΧΑΝΙΚΟΣ
 * ΑΥΤΟΚΙΝΗΤΩΝ» from being read as a civil engineer.
 *
 * The returned order is the declaration order of `ENTITY_ASSOCIATION_ROLES.project` — it is
 * **not** a ranking. Two roles here mean the text names two professions, and the caller is
 * the one holding the context needed to choose (or to ask a human).
 */
export function resolveRoleCandidatesFromProfession(text: string): readonly ProjectRole[] {
  const words = splitIntoWords(text);
  const roles: ProjectRole[] = [];
  for (const alias of PROFESSION_ALIASES) {
    if (roles.includes(alias.role)) continue;
    if (containsWordSequence(words, alias.words)) roles.push(alias.role);
  }
  return roles;
}

/**
 * The single role named by `text`, or `null` when the text does not name exactly one.
 *
 * `null` covers two different failures on purpose, because both must not be written to the
 * database: the text named no role, or it named more than one. The word «Μηχανικός» alone
 * belongs to five of the seven roles — any «closest match» rule would pick one arbitrarily,
 * and a wrong identification is worse than none: it records that a named engineer designed
 * a project they never touched.
 *
 * A caller that needs to tell «unknown» from «ambiguous» — a review UI showing the human
 * what to choose between — should call {@link resolveRoleCandidatesFromProfession}, whose
 * length is the certainty: 0 unknown, 1 certain, more than 1 ambiguous.
 */
export function resolveRoleFromProfession(text: string): ProjectRole | null {
  const candidates = resolveRoleCandidatesFromProfession(text);
  return candidates.length === 1 ? candidates[0] : null;
}
