/**
 * **Η ΑΓΚΥΡΑ ΤΟΥ «ΠΟΙΕΣ ΠΡΑΞΕΙΣ;»** — ADR-841 §7 Α5.
 *
 * 🔴 Το ελάττωμα που τη γέννησε ήταν **απουσία ερωτήματος**, όχι λάθος απάντηση:
 * το κουμπί «ζητήστε του να αναλάβει το ακίνητό σας» αποδιδόταν σε **κάθε**
 * βιτρίνα, και κανείς δεν ρωτούσε αν το γραφείο ασκεί μεσιτεία.
 *
 * ⚠️ **Η ΠΡΩΤΗ ΟΜΑΔΑ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΗ**: δύο πίνακες ISCO που **επιτρέπεται** να
 * υπάρχουν αλλά **δεν επιτρέπεται να διαφωνήσουν**. Χωρίς αυτήν, ένα νέο επάγγελμα
 * θα έμπαινε στον έναν και θα σιωπούσε στον άλλον — δηλαδή θα έπαιρνε **μηδέν
 * πράξεις σιωπηλά**, που είναι ακριβώς η βλάβη με το πρόσημο αντεστραμμένο.
 */

import { ISCO_REGISTRY_AUTHORITY } from '@/config/isco-registry-authority';
import {
  ISCO_SHOWCASE_ACTS,
  resolveShowcaseActs,
  type DeclaredShowcaseAct,
} from '@/config/isco-showcase-acts';
import { DEMO_PROFESSIONALS } from '@/config/demo-professionals';
import { BROKER_CREDENTIAL, TRADE_CREDENTIAL } from '@/lib/agency/__fixtures__/showcase-fixture';
import { acceptsMandate, actsFor } from '@/lib/professional/showcase-acts';
import type { ShowcaseCredential } from '@/types/agency-profile';

/** Ένα credential με **αυθαίρετο** ISCO — για τα επαγγέλματα που δεν έχουν fixture. */
function credentialWithIsco(iscoCode: string): ShowcaseCredential {
  return {
    ...TRADE_CREDENTIAL,
    occupation: { ...TRADE_CREDENTIAL.occupation, iscoCode },
  };
}

describe('ISCO_SHOWCASE_ACTS — οι δύο πίνακες δεν επιτρέπεται να διαφωνήσουν', () => {
  it('έχει ΑΚΡΙΒΩΣ τα ίδια κλειδιά με το ISCO_REGISTRY_AUTHORITY', () => {
    // 🔑 Ταξινομημένα ώστε το μήνυμα αποτυχίας να δείχνει **ποιο** λείπει.
    expect(Object.keys(ISCO_SHOWCASE_ACTS).sort()).toEqual(
      Object.keys(ISCO_REGISTRY_AUTHORITY).sort(),
    );
  });

  it('κάθε γραμμή δηλώνει ΛΟΓΟ — και το κενό `acts` είναι δήλωση, όχι παράλειψη', () => {
    for (const [code, entry] of Object.entries(ISCO_SHOWCASE_ACTS)) {
      expect(`${code}: ${entry.why}`.length).toBeGreaterThan(code.length + 40);
    }
  });

  it('καμία γραμμή δεν δηλώνει το καθολικό `contact` — το δίνει το σύνορο', () => {
    const declared = Object.values(ISCO_SHOWCASE_ACTS).flatMap((entry) => entry.acts);
    expect(declared).not.toContain('contact' as unknown as DeclaredShowcaseAct);
  });
});

describe('resolveShowcaseActs — μία μόνο γραμμή δίνει μεσιτεία', () => {
  it('το 3334 (μεσίτης) είναι το ΜΟΝΟ mandate ολόκληρου του πίνακα', () => {
    const withMandate = Object.entries(ISCO_SHOWCASE_ACTS)
      .filter(([, entry]) => entry.acts.includes('mandate'))
      .map(([code]) => code);
    expect(withMandate).toEqual(['3334']);
  });

  it('ο μεσίτης ΔΕΝ παίρνει work-request — η μεσιτεία δεν είναι «εργασία με προσφορά»', () => {
    expect(resolveShowcaseActs('3334')).toEqual(['mandate']);
  });

  it('ο τεχνικός φυσικού αερίου (7126) παίρνει work-request και ΟΧΙ mandate', () => {
    expect(resolveShowcaseActs('7126')).toEqual(['work-request']);
  });

  it('δικηγόρος (2611) και λογιστής (2411) δεν κερδίζουν ΚΑΜΙΑ πράξη', () => {
    expect(resolveShowcaseActs('2611')).toEqual([]);
    expect(resolveShowcaseActs('2411')).toEqual([]);
  });

  it('ο μηχανικός απαντιέται από ΠΡΟΘΕΜΑ (2142 → 214), όπως και η αρχή μητρώου', () => {
    expect(resolveShowcaseActs('2142')).toEqual(['work-request']);
    expect(resolveShowcaseActs('2151')).toEqual(['work-request']);
  });

  it('FAIL-CLOSED: άγνωστο, απόν ή κακοσχηματισμένο ⇒ καμία πράξη', () => {
    // `7112` (κτίστης) είναι πραγματικά αδήλωτο — δηλωμένο ανοιχτό του πίνακα.
    expect(resolveShowcaseActs('7112')).toEqual([]);
    expect(resolveShowcaseActs(null)).toEqual([]);
    expect(resolveShowcaseActs(undefined)).toEqual([]);
    expect(resolveShowcaseActs('όχι κωδικός')).toEqual([]);
  });
});

describe('actsFor — ο οργανισμός, όχι το επάγγελμα', () => {
  it('ΠΑΝΤΑ επαφή, ακόμη και χωρίς κανένα credential (fail-open)', () => {
    expect([...actsFor([])]).toEqual(['contact']);
  });

  it('μεσιτικό γραφείο: mandate + contact, χωρίς work-request', () => {
    const acts = actsFor([BROKER_CREDENTIAL]);
    expect(acts.has('mandate')).toBe(true);
    expect(acts.has('contact')).toBe(true);
    expect(acts.has('work-request')).toBe(false);
  });

  it('ΤΟ ΕΥΡΗΜΑ: γραφείο φυσικού αερίου ΔΕΝ δέχεται εντολή μεσιτείας', () => {
    const acts = actsFor([TRADE_CREDENTIAL]);
    expect(acts.has('mandate')).toBe(false);
    expect(acts.has('work-request')).toBe(true);
    expect(acceptsMandate([TRADE_CREDENTIAL])).toBe(false);
  });

  it('ΜΙΚΤΟ ΓΡΑΦΕΙΟ: ένωση, ποτέ τομή και ποτέ «το πρώτο νικά»', () => {
    const mixed = actsFor([TRADE_CREDENTIAL, BROKER_CREDENTIAL]);
    expect(mixed.has('mandate')).toBe(true);
    expect(mixed.has('work-request')).toBe(true);
    // ⚠️ Και με **αντίστροφη** σειρά — αλλιώς η άγκυρα θα δεχόταν `credentials[0]`.
    expect(acceptsMandate([BROKER_CREDENTIAL, TRADE_CREDENTIAL])).toBe(true);
    expect(acceptsMandate([TRADE_CREDENTIAL, BROKER_CREDENTIAL])).toBe(true);
  });

  it('δικηγορικό γραφείο: ΜΟΝΟ επαφή', () => {
    expect([...actsFor([credentialWithIsco('2611')])]).toEqual(['contact']);
  });
});

describe('τα δοκιμαστικά δεδομένα — κανένα δεν είναι μεσίτης, και κανένα δεν σπάει', () => {
  it('ΚΑΝΕΝΑΣ από τους δοκιμαστικούς επαγγελματίες δεν δέχεται εντολή μεσιτείας', () => {
    for (const professional of DEMO_PROFESSIONALS) {
      const iscoCode = professional.expectedIscoCode;
      expect({ iscoCode, mandate: resolveShowcaseActs(iscoCode).includes('mandate') }).toEqual({
        iscoCode,
        mandate: false,
      });
    }
  });

  it('το γραφείο του ευρήματος υπάρχει στα δοκιμαστικά δεδομένα με ISCO 7126', () => {
    const gas = DEMO_PROFESSIONALS.filter((p) => p.expectedIscoCode === '7126');
    expect(gas.length).toBeGreaterThan(0);
  });
});
