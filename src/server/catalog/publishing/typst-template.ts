/**
 * =============================================================================
 * ΤΟ ΠΡΟΤΥΠΟ TYPST ΤΟΥ ΕΚΔΟΤΗ (ADR-923 §5.6 · §5.6.1)
 * =============================================================================
 *
 * Ένα πρότυπο, δύο προφίλ: διαβάζει το `document.json` (το ουδέτερο μοντέλο) και το `--input profile=…`.
 *
 * 🔒 **Καμία ένωση κειμένου σε κώδικα**: κάθε κείμενο του προμηθευτή φτάνει ως τιμή JSON και μπαίνει με `[#value]`, άρα
 *    τυπώνεται αυτούσιο. Ένα «#import» σε περιγραφή παραμένει γράμματα.
 * 🔒 Χωρίς πακέτα (`@preview`), χωρίς γραμματοσειρές συστήματος, με `--root` τον φάκελο εργασίας: το πρότυπο δεν φτάνει ούτε
 *    στο δίκτυο ούτε έξω από αυτόν.
 * 🔴 Κανένα προεπιλεγμένο μαύρο: στο προφίλ εκτύπωσης κάθε χρώμα περνά από το `ink()`, αλλιώς θα έβγαινε RGB/gray μέσα σε
 *    CMYK αρχείο.
 * 🔴 **Κανένα κελί δεν πατά το διπλανό** (μετρημένο στο PDF, 2026-10-31): το `justify` ενεργοποιεί τον βελτιστοποιητή γραμμών,
 *    που σε στενό κελί προτιμά μία υπερχειλισμένη γραμμή από το αναδίπλωμα, και η τιμή έπεφτε πάνω στη διπλανή. Γι' αυτό
 *    `justify: false` μέσα σε πίνακες, και το `fitted` μικραίνει το μέγεθος όταν η φαρδύτερη άθραυστη λέξη δεν χωρά.
 * 🔴 **Η ομάδα δεν χάνει την ετικέτα της σε αλλαγή σελίδας**: το `rail` είναι κελί `breakable: false`, το `band` υποκεφαλίδα
 *    `level: 2` που επαναλαμβάνεται. Χωρίς αυτά, οι γραμμές της επόμενης σελίδας έμεναν χωρίς ομάδα.
 * ⚠️ Ζει ως σταθερά TypeScript και όχι ως αρχείο `.typ`: το standalone του Next αντιγράφει μόνο ό,τι ανιχνεύει ως import.
 * ⚠️ Κάθε αλλαγή εδώ αλλάζει bytes ⇒ ανέβασε το `PUBLICATION_RENDER_SCHEMA_VERSION`.
 *
 * @module server/catalog/publishing/typst-template
 */

export const TYPST_TEMPLATE_FILENAME = 'catalog.typ';
export const TYPST_DOCUMENT_FILENAME = 'document.json';
export const TYPST_ASSET_DIR = 'assets';

export const PUBLICATION_TYPST_TEMPLATE = String.raw`
#let doc = json("document.json")
#let profile = sys.inputs.at("profile", default: "screen")
#let is-print = profile == "print"
#let theme = doc.theme
#let bleed = if is-print { doc.page.bleedMm * 1mm } else { 0mm }

#let ink(c) = if is-print {
  cmyk(c.cmyk.at(0) * 1%, c.cmyk.at(1) * 1%, c.cmyk.at(2) * 1%, c.cmyk.at(3) * 1%)
} else {
  rgb(c.rgb)
}
#let paper-blank = if is-print { cmyk(0%, 0%, 0%, 0%) } else { rgb("#ffffff") }
#let ink-primary = ink(theme.primary)
#let ink-accent = ink(theme.accent)
#let ink-tint = ink(theme.tint)
#let ink-text = ink(theme.text)
#let ink-rule = ink(theme.rule)

#set document(title: doc.title)
#set text(font: theme.fontFamily, lang: doc.language, size: 9pt, fill: ink-text, hyphenate: true, costs: (hyphenation: 200%))
#set par(justify: true, leading: 0.55em)
#set line(stroke: 0.5pt + ink-rule)
#set heading(numbering: none)
#let heading-text(size, colour, body) = {
  set par(justify: false)
  text(size: size, weight: "bold", fill: colour, hyphenate: false, body)
}
#show heading.where(level: 1): it => block(sticky: true, below: 6mm, heading-text(22pt, ink-primary, it.body))
#show heading.where(level: 2): it => block(sticky: true, below: 4mm, heading-text(14pt, ink-primary, it.body))
#show heading.where(level: 3): it => block(sticky: true, above: 4mm, below: 2mm, heading-text(10pt, ink-accent, it.body))
#show link: it => text(fill: ink-accent, it)

#set page(
  width: doc.page.widthMm * 1mm + 2 * bleed,
  height: doc.page.heightMm * 1mm + 2 * bleed,
  margin: doc.page.marginMm * 1mm + bleed,
  footer: context {
    set text(size: 7pt, fill: ink-text)
    grid(columns: (1fr, auto), align: (left, right), doc.footer, counter(page).display())
  },
)

#let inline-of(item) = {
  let body = [#item.text]
  if item.at("strong", default: false) { body = strong(body) }
  if item.at("emphasis", default: false) { body = emph(body) }
  let target = item.at("link", default: none)
  if target != none { link(target, body) } else { body }
}
#let inlines-of(items) = items.map(inline-of).join()

#let image-of(ref) = layout(area => image(
  "assets/" + ref.assetId + ".jpg",
  width: calc.min(ref.widthMm * 1mm, area.width),
  alt: ref.alt,
))

#let cell-size = 7.5pt
#let cell-inset-x = 0.8mm
#let rail-size = 7pt
#let rail-row-estimate = 4.6mm

// Άνω όριο πλάτους: 1em ανά byte. Ό,τι χωρά με αυτό δεν μετριέται καθόλου: μέτρηση σε κάθε κελί έκανε τις 660 σελίδες 83 s αντί 7 s.
#let surely-fits(value, room) = value.len() * cell-size <= room

#let fitted(value, weight, colour, room) = {
  let render(size) = text(size: size, fill: colour, weight: weight, hyphenate: false)[#value]
  if surely-fits(value, room) { return render(cell-size) }
  context {
    let sample(token) = if surely-fits(token, room) { 0pt } else { measure(text(size: cell-size, weight: weight, hyphenate: false, token)).width }
    let widest = calc.max(0pt, ..value.split(regex("[\\s\u{200B}]+")).map(sample))
    render(if widest > room { cell-size * (room / widest) } else { cell-size })
  }
}

#let rail-label(c, colour) = context {
  let label(body) = text(size: rail-size, weight: "bold", fill: colour, hyphenate: false, body)
  let whole = measure(label(c.text)).width
  let longest = calc.max(0pt, ..c.text.split(" ").map(word => measure(label(word)).width))
  let room = calc.max(c.rowSpan * rail-row-estimate, whole / 2 + 3mm, longest)
  rotate(-90deg, reflow: true, box(width: calc.min(room, whole + 1pt), align(center, label(c.text))))
}

#let cell-style(role) = if role == "corner" or role == "columnHead" {
  (fill: ink-primary, colour: paper-blank, weight: "bold", align: center + horizon)
} else if role == "groupBand" or role == "groupRail" {
  (fill: ink-tint, colour: ink-primary, weight: "bold", align: left + horizon)
} else if role == "rowHead" {
  (fill: none, colour: ink-text, weight: "regular", align: left + horizon)
} else if role == "price" {
  (fill: ink-tint, colour: ink-text, weight: "bold", align: center + horizon)
} else {
  (fill: none, colour: ink-text, weight: "regular", align: center + horizon)
}

#let cell-of(c, room) = {
  let style = cell-style(c.role)
  let rail = c.role == "groupRail"
  let body = if rail { rail-label(c, style.colour) } else { fitted(c.text, style.weight, style.colour, room(c)) }
  table.cell(colspan: c.colSpan, rowspan: c.rowSpan, fill: style.fill, align: style.align, breakable: if rail { false } else { auto }, body)
}

#let table-rows(rows, room) = {
  let parts = ()
  let cells-of(row) = row.cells.map(c => cell-of(c, room))
  let head = rows.filter(row => row.header).map(cells-of).flatten()
  if head.len() > 0 { parts.push(table.header(repeat: true, ..head)) }
  for row in rows.filter(row => not row.header) {
    if row.cells.first().role == "groupBand" { parts.push(table.header(level: 2, repeat: true, ..cells-of(row))) } else { parts += cells-of(row) }
  }
  parts
}

#let content-width = (doc.page.widthMm - 2 * doc.page.marginMm) * 1mm

// Τα πλάτη είναι γνωστά από το μοντέλο: το ωφέλιμο πλάτος κάθε κελιού, χωρίς κανένα layout() στη διάρκεια της απόδοσης.
#let cell-room(t, fixed, values) = c => {
  let value-width = (content-width - fixed) / calc.max(values, 1)
  let width = if c.role == "rowHead" or c.role == "corner" { t.labelColumnMm * 1mm } else if c.role == "groupBand" { content-width } else { value-width * c.colSpan }
  width - 2 * cell-inset-x
}

#let table-of(t) = {
  set par(justify: false)
  let rail = if t.railColumn { (t.railColumnMm * 1mm,) } else { () }
  let value-columns = t.columnCount - rail.len() - 1
  let widths = rail + (t.labelColumnMm * 1mm,) + range(value-columns).map(_ => 1fr)
  let fixed = rail.sum(default: 0mm) + t.labelColumnMm * 1mm
  table(columns: widths, stroke: 0.4pt + ink-rule, inset: (x: cell-inset-x, y: 1.2mm), ..table-rows(t.rows, cell-room(t, fixed, value-columns)))
}

#let card-of(card) = {
  set par(justify: false)
  if card.image != none { align(center, image-of(card.image)) }
  text(weight: "bold", hyphenate: false)[#card.title]
  if card.code != none { linebreak(); text(size: 7.5pt, fill: ink-accent)[#card.code] }
  for line in card.lines { linebreak(); text(size: 7.5pt)[#line] }
  if card.price != none { linebreak(); text(weight: "bold", fill: ink-primary)[#card.price] }
}

#let cards-of(b) = grid(
  columns: range(b.columns).map(_ => 1fr),
  gutter: 4mm,
  inset: 2mm,
  ..b.cards.map(card => grid.cell(breakable: false, stroke: 0.4pt + ink-rule, card-of(card))),
)

#let code-index-of(block-data) = context {
  let pages = (:)
  for marker in query(<catalog-anchor>) { pages.insert(marker.value, marker.location().page()) }
  set par(justify: false)
  columns(block-data.columns, gutter: 6mm, for entry in block-data.entries {
    grid(
      columns: (1fr, auto),
      column-gutter: 2mm,
      text(size: 7.5pt)[#strong(entry.code) #h(1mm) #entry.label],
      text(size: 7.5pt, str(pages.at(entry.anchor, default: 0))),
    )
  })
}

#let block-of(b) = if b.kind == "heading" {
  heading(level: b.level, outlined: b.outlined)[#b.text]
} else if b.kind == "paragraph" {
  par(inlines-of(b.inlines))
} else if b.kind == "bullets" {
  let items = b.items.map(inlines-of)
  if b.ordered { enum(..items) } else { list(..items) }
} else if b.kind == "image" {
  block(image-of(b.image))
} else if b.kind == "table" {
  table-of(b.table)
} else if b.kind == "grid" {
  cards-of(b)
} else if b.kind == "toc" {
  outline(title: [#b.title], depth: 2)
} else if b.kind == "codeIndex" {
  code-index-of(b)
} else if b.kind == "anchor" {
  [#metadata(b.anchor) <catalog-anchor>]
}

#let full-page(section, fill) = page(fill: fill, footer: none, {
  set text(fill: paper-blank)
  show heading: it => block(heading-text(34pt, paper-blank, it.body))
  align(center + horizon, section.blocks.map(block-of).join())
})

#for (index, section) in doc.sections.enumerate() {
  if section.template in ("cover", "chapterDivider", "backCover") {
    full-page(section, ink-primary)
  } else {
    if index > 0 { pagebreak(weak: true) }
    section.blocks.map(block-of).join()
  }
}
`;
