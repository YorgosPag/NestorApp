/**
 * **Το κείμενο του IDML** (ADR-923 §5.6.1): από τα μπλοκ του ουδέτερου μοντέλου στο XML μιας Story, καθαρό.
 *
 * 🔑 Μία Story για όλο το σώμα, περασμένη σε συνδεδεμένα πλαίσια: ο σχεδιαστής αλλάζει μια γραμμή και το κείμενο ξαναρέει.
 *    Οι πίνακες μένουν **πραγματικοί** πίνακες του InDesign, με επαναλαμβανόμενη κεφαλίδα.
 * ⚠️ Τα περιεχόμενα και το ευρετήριο κωδικών τυπώνονται χωρίς αριθμούς σελίδας: τους ξέρει μόνο η διάταξη του InDesign.
 * @module subapps/catalog/publishing/idml-story
 */

import type { LayoutBlock, LayoutCell, LayoutDocument, LayoutGridCard, LayoutImageRef, LayoutInline, LayoutQrCode, LayoutTable } from './layout-model';

export const MM_TO_PT = 72 / 25.4;
export const IDML_STYLES = ['Body', 'Heading1', 'Heading2', 'Heading3', 'Bullet', 'Cell', 'CellHead', 'Footer'] as const;
export type IdmlStyle = (typeof IDML_STYLES)[number];

/** Ό,τι χρειάζεται μια εικόνα: το αρχείο στο `Links/` και οι διαστάσεις της. */
export interface IdmlImage {
  readonly fileName: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface StoryContext {
  readonly nextId: () => string;
  readonly images: ReadonlyMap<string, IdmlImage>;
  readonly areaPt: number;
}

export function escapeXml(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const NO_CHARACTER_STYLE = 'CharacterStyle/$ID/[No character style]';

function run(body: string, fontStyle?: string): string {
  return `<CharacterStyleRange AppliedCharacterStyle="${NO_CHARACTER_STYLE}"${fontStyle ? ` FontStyle="${fontStyle}"` : ''}>${body}</CharacterStyleRange>`;
}

const textRun = (text: string, fontStyle?: string): string => run(`<Content>${escapeXml(text)}</Content>`, fontStyle);

function inlineRun(inline: LayoutInline): string {
  const style = inline.strong ? (inline.emphasis ? 'Bold Italic' : 'Bold') : inline.emphasis ? 'Italic' : undefined;
  return textRun(inline.text, style);
}

function paragraph(style: IdmlStyle, runs: string, nextPage = false): string {
  return `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${style}"${nextPage ? ' StartParagraph="NextPage"' : ''}>${runs}<Br/></ParagraphStyleRange>`;
}

function imageFrame(ref: LayoutImageRef, ctx: StoryContext): string {
  const image = ctx.images.get(ref.assetId);
  if (!image) return '';
  const widthPt = ref.widthMm * MM_TO_PT;
  const scale = widthPt / image.widthPx;
  const heightPt = image.heightPx * scale;
  const point = (x: number, y: number) => `<PathPointType Anchor="${x} ${y}" LeftDirection="${x} ${y}" RightDirection="${x} ${y}"/>`;
  return `<Rectangle Self="${ctx.nextId()}" ContentType="GraphicType" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0">`
    + `<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>${point(0, 0)}${point(0, heightPt)}${point(widthPt, heightPt)}${point(widthPt, 0)}</PathPointArray></GeometryPathType></PathGeometry></Properties>`
    + `<Image Self="${ctx.nextId()}" ItemTransform="${scale} 0 0 ${scale} 0 0"><Properties><GraphicBounds Left="0" Top="0" Right="${image.widthPx}" Bottom="${image.heightPx}"/></Properties>`
    + `<Link Self="${ctx.nextId()}" LinkResourceURI="file:Links/${encodeURIComponent(image.fileName)}"/></Image></Rectangle>`;
}

interface PlacedCell {
  readonly cell: LayoutCell;
  readonly column: number;
  readonly row: number;
}

/** Ο πραγματικός αριθμός στήλης κάθε κελιού: όσα καλύπτει `rowSpan` από πάνω δεν γράφονται, άρα η θέση υπολογίζεται. */
export function placeTableCells(table: LayoutTable): readonly PlacedCell[] {
  const taken = new Set<string>();
  return table.rows.flatMap((row, rowIndex) => {
    let column = 0;
    return row.cells.map((cell) => {
      while (taken.has(`${column}:${rowIndex}`)) column += 1;
      const placed = { cell, column, row: rowIndex };
      for (let across = 0; across < cell.colSpan; across += 1) for (let down = 0; down < cell.rowSpan; down += 1) taken.add(`${column + across}:${rowIndex + down}`);
      column += cell.colSpan;
      return placed;
    });
  });
}

const isHeadRole = (role: LayoutCell['role']): boolean => role === 'corner' || role === 'columnHead' || role === 'groupBand' || role === 'groupRail';

function cellXml(placed: PlacedCell, ctx: StoryContext): string {
  const { cell, column, row } = placed;
  const head = isHeadRole(cell.role);
  return `<Cell Self="${ctx.nextId()}" Name="${column}:${row}" RowSpan="${cell.rowSpan}" ColumnSpan="${cell.colSpan}" AppliedCellStyle="CellStyle/$ID/[None]"${head ? ' FillColor="Color/Tint"' : ''}>`
    + `<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/${head || cell.role === 'rowHead' ? 'CellHead' : 'Cell'}">${textRun(cell.text)}</ParagraphStyleRange></Cell>`;
}

function columnWidths(table: LayoutTable, areaPt: number): readonly number[] {
  const fixed = [...(table.railColumn ? [table.railColumnMm * MM_TO_PT] : []), table.labelColumnMm * MM_TO_PT];
  const rest = table.columnCount - fixed.length;
  const width = rest > 0 ? (areaPt - fixed.reduce((sum, value) => sum + value, 0)) / rest : 0;
  return [...fixed, ...Array.from({ length: rest }, () => width)];
}

function tableShell(ctx: StoryContext, shape: { readonly header: number; readonly body: number; readonly widths: readonly number[]; readonly cells: string }): string {
  const rows = Array.from({ length: shape.header + shape.body }, (_, index) => `<Row Self="${ctx.nextId()}" Name="${index}"/>`).join('');
  const columns = shape.widths.map((width, index) => `<Column Self="${ctx.nextId()}" Name="${index}" SingleColumnWidth="${width}"/>`).join('');
  return `<Table Self="${ctx.nextId()}" HeaderRowCount="${shape.header}" FooterRowCount="0" BodyRowCount="${shape.body}" ColumnCount="${shape.widths.length}" AppliedTableStyle="TableStyle/$ID/[Basic Table]">${rows}${columns}${shape.cells}</Table>`;
}

function tableXml(table: LayoutTable, ctx: StoryContext): string {
  const header = table.rows.findIndex((row) => !row.header);
  const headerRows = header === -1 ? table.rows.length : header;
  const cells = placeTableCells(table).map((placed) => cellXml(placed, ctx)).join('');
  return paragraph('Body', run(tableShell(ctx, { header: headerRows, body: table.rows.length - headerRows, widths: columnWidths(table, ctx.areaPt), cells })));
}

function cardParagraphs(card: LayoutGridCard, ctx: StoryContext): string {
  const image = card.image ? paragraph('Cell', run(imageFrame(card.image, ctx))) : '';
  const lines = [card.code, ...card.lines, card.price].filter((line): line is string => Boolean(line));
  return `${image}${paragraph('CellHead', textRun(card.title))}${lines.map((line) => paragraph('Cell', textRun(line))).join('')}`;
}

function gridXml(block: Extract<LayoutBlock, { kind: 'grid' }>, ctx: StoryContext): string {
  const rows = Math.ceil(block.cards.length / block.columns);
  const cells = Array.from({ length: rows * block.columns }, (_, index) => {
    const card = block.cards[index];
    const body = card ? cardParagraphs(card, ctx) : paragraph('Cell', textRun(''));
    return `<Cell Self="${ctx.nextId()}" Name="${index % block.columns}:${Math.floor(index / block.columns)}" RowSpan="1" ColumnSpan="1" AppliedCellStyle="CellStyle/$ID/[None]">${body}</Cell>`;
  }).join('');
  const widths = Array.from({ length: block.columns }, () => ctx.areaPt / block.columns);
  return paragraph('Body', run(tableShell(ctx, { header: 0, body: rows, widths, cells })));
}

function codeIndexXml(block: Extract<LayoutBlock, { kind: 'codeIndex' }>, ctx: StoryContext): string {
  const cells = block.entries.flatMap((entry, row) => [[0, entry.code], [1, entry.label]].map(([column, text]) =>
    `<Cell Self="${ctx.nextId()}" Name="${column}:${row}" RowSpan="1" ColumnSpan="1" AppliedCellStyle="CellStyle/$ID/[None]"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Cell">${textRun(String(text))}</ParagraphStyleRange></Cell>`)).join('');
  return paragraph('Body', run(tableShell(ctx, { header: 0, body: block.entries.length, widths: [ctx.areaPt * 0.3, ctx.areaPt * 0.7], cells })));
}

function tocXml(block: Extract<LayoutBlock, { kind: 'toc' }>, document: LayoutDocument): string {
  const headings = document.sections.flatMap((section) => section.blocks.flatMap((candidate) => (candidate.kind === 'heading' && candidate.outlined ? [candidate] : [])));
  return paragraph('Heading1', textRun(block.title)) + headings.map((heading) => paragraph('Body', textRun(heading.text))).join('');
}

const HEADING_STYLE: Readonly<Record<1 | 2 | 3, IdmlStyle>> = { 1: 'Heading1', 2: 'Heading2', 3: 'Heading3' };

/** Το δείγμα του μελανιού του QR στο `Graphic.xml`: ένα, από το `PUBLICATION_QR_INK`, όχι το [Black] που τυπώνει πάνω από ό,τι βρει. */
export const IDML_QR_SWATCH = 'QrInk';

const pt = (value: number): number => Math.round(value * 1000) / 1000;

function closedPath(x0: number, y0: number, x1: number, y1: number): string {
  const point = (x: number, y: number) => `<PathPointType Anchor="${pt(x)} ${pt(y)}" LeftDirection="${pt(x)} ${pt(y)}" RightDirection="${pt(x)} ${pt(y)}"/>`;
  return `<GeometryPathType PathOpen="false"><PathPointArray>${point(x0, y0)}${point(x0, y1)}${point(x1, y1)}${point(x1, y0)}</PathPointArray></GeometryPathType>`;
}

/**
 * Το QR ως **διάνυσμα του InDesign** (§5.13 Σ7 κενό δ): ίδιες σειρές μονάδων με το Typst (`qr-symbol`), ίδιο μέγεθος.
 * Ομάδα δύο σχημάτων, στη ροή του κειμένου όπως η εικόνα: (1) ορθογώνιο χαρτιού στο μέγεθος του συμβόλου **με** τη ζώνη
 * ησυχίας, ώστε η ζώνη να μένει λευκή όπου κι αν το μετακινήσει ο σχεδιαστής· (2) ένα σύνθετο σχήμα, μία κλειστή διαδρομή
 * ανά σειρά σκούρων μονάδων. Οι σειρές δεν επικαλύπτονται, άρα ο κανόνας γεμίσματος δεν αλλάζει τίποτα.
 */
function qrGroupXml(qr: LayoutQrCode, ctx: StoryContext): string {
  const module = qr.moduleMm * MM_TO_PT;
  const quiet = qr.quietModules * module;
  const side = (qr.modules + 2 * qr.quietModules) * module;
  const runs = qr.runs.map(([row, column, length]) => closedPath(quiet + column * module, quiet + row * module, quiet + (column + length) * module, quiet + (row + 1) * module)).join('');
  const shape = (tag: string, fill: string, paths: string) =>
    `<${tag} Self="${ctx.nextId()}" ContentType="Unassigned" FillColor="${fill}" StrokeColor="Swatch/None" StrokeWeight="0" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0"><Properties><PathGeometry>${paths}</PathGeometry></Properties></${tag}>`;
  return `<Group Self="${ctx.nextId()}" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="1 0 0 1 0 0">`
    + shape('Rectangle', 'Color/Paper', closedPath(0, 0, side, side))
    + shape('Polygon', `Color/${IDML_QR_SWATCH}`, runs)
    + '</Group>';
}

/**
 * Η επικεφαλίδα, το σύμβολο QR ως διάνυσμα, και κάτω του η διεύθυνση ως κείμενο (§5.13 Σ7): ο άνθρωπος τη διαβάζει
 * και ο σχεδιαστής την ελέγχει, και είναι η ίδια με του PDF.
 */
function headingXml(block: Extract<LayoutBlock, { kind: 'heading' }>, ctx: StoryContext): string {
  const title = paragraph(HEADING_STYLE[block.level], textRun(block.text));
  if (!block.qr) return title;
  return title + paragraph('Body', run(qrGroupXml(block.qr, ctx))) + paragraph('Body', textRun(`${block.qr.caption}: ${block.qr.url}`));
}

function blockXml(block: LayoutBlock, ctx: StoryContext, document: LayoutDocument): string {
  switch (block.kind) {
    case 'heading': return headingXml(block, ctx);
    case 'paragraph': return paragraph('Body', block.inlines.map(inlineRun).join(''));
    case 'bullets': return block.items.map((item) => paragraph('Bullet', item.map(inlineRun).join(''))).join('');
    case 'image': return paragraph('Body', run(imageFrame(block.image, ctx)));
    case 'table': return tableXml(block.table, ctx);
    case 'grid': return gridXml(block, ctx);
    case 'codeIndex': return codeIndexXml(block, ctx);
    case 'toc': return tocXml(block, document);
    case 'anchor': return '';
  }
}

/** Το σώμα. Κάθε ενότητα ξεκινά σε νέα σελίδα, όπως στο PDF, με ιδιότητα της πρώτης παραγράφου της. */
export function bodyStoryXml(document: LayoutDocument, ctx: StoryContext): string {
  return document.sections.map((section) => {
    const body = section.blocks.map((block) => blockXml(block, ctx, document)).join('');
    return body.replace('<ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/', '<ParagraphStyleRange StartParagraph="NextPage" AppliedParagraphStyle="ParagraphStyle/');
  }).join('');
}

/** Το υποσέλιδο με τον αυτόματο αριθμό σελίδας του InDesign. */
export function footerStoryXml(footer: string): string {
  return paragraph('Footer', `${textRun(footer === '' ? '' : `${footer}   `)}${run('<Content><?ACE 18?></Content>')}`);
}
