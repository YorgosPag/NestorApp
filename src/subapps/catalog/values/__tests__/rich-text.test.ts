/**
 * Η γραμματική του `richText` (ADR-923 §5.10.2): μέσα στη γλώσσα ⇒ δεκτό ως έχει· εκτός ⇒ απόρριψη με θέση.
 * Κάθε επίθεση του OWASP XSS cheat sheet που χωρά σε περιγραφή προϊόντος πρέπει να πέφτει **έξω** από τη γλώσσα.
 */

import { checkRichText } from '../rich-text';

const ok = (html: string) => checkRichText(html).ok;

describe('μέσα στη γλώσσα', () => {
  it.each([
    ['', 'κενό'],
    ['Σκέτο κείμενο με > και & σύμβολα', 'κείμενο χωρίς ετικέτες'],
    ['<p>Fan coil δαπέδου.</p><p>Χειριστήριο <strong>περιλαμβάνεται</strong>.</p>', 'παράγραφοι + έμφαση'],
    ['<ul><li>2,5 kW</li><li>230V</li></ul>', 'λίστα'],
    ['Γραμμή<br>επόμενη<br/>τρίτη', 'αλλαγή γραμμής (και αυτοκλειόμενη)'],
    ['<p><a href="https://aries.gr/mfp">φυλλάδιο</a> · <a href="mailto:info@aries.gr">email</a></p>', 'ασφαλείς σύνδεσμοι'],
    ['m<sup>3</sup>/h · H<sub>2</sub>O', 'δείκτες'],
  ])('%s (%s)', (html) => {
    expect(ok(html)).toBe(true);
  });
});

describe('ΕΚΤΟΣ γλώσσας — απόρριψη, όχι καθάρισμα', () => {
  it.each([
    ['<script>alert(1)</script>', 'script'],
    ['<p onclick="x()">a</p>', 'χειριστής συμβάντος'],
    ['<a href="javascript:alert(1)">a</a>', 'javascript:'],
    ['<a href="JaVaScRiPt:alert(1)">a</a>', 'javascript: με κεφαλαία'],
    ['<a href=" https://x.gr">a</a>', 'href με κενό μπροστά'],
    ['<a href="data:text/html,<b>">a</a>', 'data:'],
    ['<img src=x onerror=alert(1)>', 'img'],
    ['<svg><script>1</script></svg>', 'svg'],
    ['<p style="color:red">a</p>', 'χαρακτηριστικό εκτός λίστας'],
    ['<!-- σχόλιο --><p>a</p>', 'σχόλιο'],
    ['<![CDATA[x]]>', 'CDATA'],
    ['a < b', '`<` χωρίς ετικέτα'],
    ['<p>ανοιχτό', 'ανοιχτή ετικέτα'],
    ['<p><strong>a</p></strong>', 'λάθος φώλιασμα'],
    ['</p>', 'κλείσιμο χωρίς άνοιγμα'],
    ['<a>χωρίς href</a>', 'σύνδεσμος χωρίς στόχο'],
    ['<strong href="https://x.gr">a</strong>', 'href εκτός συνδέσμου'],
    ['<p/>', 'αυτοκλειόμενη μη κενή ετικέτα'],
  ])('%s (%s)', (html) => {
    expect(ok(html)).toBe(false);
  });

  it('η απόρριψη λέει ΠΟΥ χάλασε', () => {
    expect(checkRichText('<p>καλό</p><script>x</script>')).toEqual({ ok: false, offset: 11 });
  });
});
