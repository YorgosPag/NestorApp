/**
 * **Το δεύτερο σκέλος του ουδέτερου μοντέλου: IDML** (ADR-923 §5.6 · §5.6.1). Από το `LayoutDocument` στα μέρη ενός πακέτου InDesign,
 * καθαρό: ίδια είσοδος ⇒ ίδια bytes, χωρίς «τώρα» και χωρίς τυχαίο.
 *
 * 🔑 Οι κανόνες δομής έρχονται από πραγματικά δείγματα IDML, και η άγκυρα ελέγχει ό,τι ορίζει το πακέτο: μοναδικά `Self`, αναφορές του
 *    `designmap.xml`, αλυσίδα πλαισίων, πλήθος γραμμών πίνακα.
 * ⚠️ Το αν ανοίγει στο InDesign δεν αποδεικνύεται εδώ: δεν υπάρχει InDesign στο CI (§5.6.1).
 * @module subapps/catalog/publishing/idml-document
 */

import type { LayoutColour, LayoutDocument } from './layout-model';
import { bodyStoryXml, escapeXml, footerStoryXml, IDML_STYLES, MM_TO_PT, type IdmlImage, type IdmlStyle, type StoryContext } from './idml-story';

export const IDML_MIMETYPE = 'application/vnd.adobe.indesign-idml-package';
const DOM_VERSION = '20.0';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PACKAGING_NS = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
const BODY_STORY = 'ustory';
const FOOTER_STORY = 'ufooter';
const MASTER = 'umaster';
const FOOTER_HEIGHT_PT = 14;

export interface IdmlInput {
  readonly document: LayoutDocument;
  /** Οι σελίδες του PDF: τόσα πλαίσια χρειάζεται το κείμενο για να μη μείνει υπερχείλιση με τη διάταξή μας. */
  readonly pageCount: number;
  readonly images: ReadonlyMap<string, IdmlImage>;
}

export interface IdmlPart {
  readonly path: string;
  readonly content: string;
}

const part = (tag: string, body: string): string => `${XML_HEAD}<idPkg:${tag} xmlns:idPkg="${PACKAGING_NS}" DOMVersion="${DOM_VERSION}">${body}</idPkg:${tag}>`;

interface PageBox {
  readonly widthPt: number;
  readonly heightPt: number;
  readonly marginPt: number;
}

function pageBoxOf(document: LayoutDocument): PageBox {
  return { widthPt: document.page.widthMm * MM_TO_PT, heightPt: document.page.heightMm * MM_TO_PT, marginPt: document.page.marginMm * MM_TO_PT };
}

function framePath(width: number, height: number): string {
  const point = (x: number, y: number) => `<PathPointType Anchor="${x} ${y}" LeftDirection="${x} ${y}" RightDirection="${x} ${y}"/>`;
  return `<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray>${point(0, 0)}${point(0, height)}${point(width, height)}${point(width, 0)}</PathPointArray></GeometryPathType></PathGeometry></Properties>`;
}

function textFrame(input: { readonly id: string; readonly story: string; readonly previous: string; readonly next: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }): string {
  return `<TextFrame Self="${input.id}" ParentStory="${input.story}" PreviousTextFrame="${input.previous}" NextTextFrame="${input.next}" ContentType="TextType" AppliedObjectStyle="ObjectStyle/$ID/[None]" Visible="true" ItemTransform="1 0 0 1 ${input.x} ${input.y}">${framePath(input.width, input.height)}</TextFrame>`;
}

function spreadPart(index: number, pageCount: number, box: PageBox): IdmlPart {
  const frame = (at: number) => (at < 0 || at >= pageCount ? 'n' : `uframe${at}`);
  const inner = { width: box.widthPt - 2 * box.marginPt, height: box.heightPt - 2 * box.marginPt - FOOTER_HEIGHT_PT };
  const body = `<Spread Self="uspread${index}" PageCount="1" BindingLocation="0" ShowMasterItems="true" AllowPageShuffle="true" ItemTransform="1 0 0 1 0 0">`
    + `<Page Self="upage${index}" Name="${index + 1}" AppliedMaster="${MASTER}" ItemTransform="1 0 0 1 0 0" GeometricBounds="0 0 ${box.heightPt} ${box.widthPt}" MasterPageTransform="1 0 0 1 0 0"/>`
    + textFrame({ id: frame(index), story: BODY_STORY, previous: frame(index - 1), next: frame(index + 1), x: box.marginPt, y: box.marginPt, ...inner })
    + '</Spread>';
  return { path: `Spreads/Spread_uspread${index}.xml`, content: part('Spread', body) };
}

function masterPart(box: PageBox): IdmlPart {
  const footer = textFrame({ id: 'ufooterframe', story: FOOTER_STORY, previous: 'n', next: 'n', x: box.marginPt, y: box.heightPt - box.marginPt - FOOTER_HEIGHT_PT, width: box.widthPt - 2 * box.marginPt, height: FOOTER_HEIGHT_PT });
  const body = `<MasterSpread Self="${MASTER}" Name="A-Master" NamePrefix="A" BaseName="Master" PageCount="1" ShowMasterItems="false" ItemTransform="1 0 0 1 0 0">`
    + `<Page Self="${MASTER}page" Name="" AppliedMaster="n" ItemTransform="1 0 0 1 0 0" GeometricBounds="0 0 ${box.heightPt} ${box.widthPt}"/>${footer}</MasterSpread>`;
  return { path: `MasterSpreads/MasterSpread_${MASTER}.xml`, content: part('MasterSpread', body) };
}

const storyPart = (id: string, body: string): IdmlPart => ({ path: `Stories/Story_${id}.xml`, content: part('Story', `<Story Self="${id}">${body}</Story>`) });

const colourXml = (self: string, colour: LayoutColour): string =>
  `<Color Self="Color/${self}" Model="Process" Space="CMYK" ColorValue="${colour.cmyk.join(' ')}" Name="${self}" ColorEditable="true" ColorRemovable="true" Visible="true"/>`;

function graphicPart(document: LayoutDocument): IdmlPart {
  const { theme } = document;
  const fixed = '<Color Self="Color/Black" Model="Process" Space="CMYK" ColorValue="0 0 0 100" ColorOverride="Specialblack" Name="Black" ColorEditable="false" ColorRemovable="false" Visible="true"/>'
    + '<Color Self="Color/Paper" Model="Process" Space="CMYK" ColorValue="0 0 0 0" ColorOverride="Specialpaper" Name="Paper" ColorEditable="true" ColorRemovable="false" Visible="true"/>'
    + '<Swatch Self="Swatch/None" Name="None" ColorEditable="false" ColorRemovable="false" Visible="true"/>';
  return { path: 'Resources/Graphic.xml', content: part('Graphic', `${fixed}${colourXml('Primary', theme.primary)}${colourXml('Accent', theme.accent)}${colourXml('Tint', theme.tint)}${colourXml('Text', theme.text)}`) };
}

function fontsPart(document: LayoutDocument): IdmlPart {
  const family = escapeXml(document.theme.fontFamily);
  const faces = ['Regular', 'Bold', 'Italic', 'Bold Italic'].map((style) => `<Font Self="Font/${family} ${style}" FontFamily="${family}" Name="${family} ${style}" PostScriptName="${family.replace(/ /g, '')}-${style.replace(/ /g, '')}" Status="Installed" FontStyleName="${style}" FontType="TrueType"/>`).join('');
  return { path: 'Resources/Fonts.xml', content: part('Fonts', `<FontFamily Self="FontFamily/${family}" Name="${family}">${faces}</FontFamily>`) };
}

/** Μεγέθη όπως στο πρότυπο Typst, ώστε το πρώτο άνοιγμα να μοιάζει με το PDF. */
const STYLE_OF: Readonly<Record<IdmlStyle, { readonly size: number; readonly fontStyle: string; readonly colour: string }>> = {
  Body: { size: 9, fontStyle: 'Regular', colour: 'Text' },
  Heading1: { size: 24, fontStyle: 'Bold', colour: 'Primary' },
  Heading2: { size: 14, fontStyle: 'Bold', colour: 'Primary' },
  Heading3: { size: 10, fontStyle: 'Bold', colour: 'Text' },
  Bullet: { size: 9, fontStyle: 'Regular', colour: 'Text' },
  Cell: { size: 7.5, fontStyle: 'Regular', colour: 'Text' },
  CellHead: { size: 7.5, fontStyle: 'Bold', colour: 'Text' },
  Footer: { size: 7, fontStyle: 'Regular', colour: 'Text' },
};

function stylesPart(document: LayoutDocument): IdmlPart {
  const font = `<Properties><AppliedFont type="string">${escapeXml(document.theme.fontFamily)}</AppliedFont></Properties>`;
  const styles = IDML_STYLES.map((name) => {
    const style = STYLE_OF[name];
    const bullets = name === 'Bullet' ? ' BulletsAndNumberingListType="BulletList" LeftIndent="12" FirstLineIndent="-12"' : '';
    return `<ParagraphStyle Self="ParagraphStyle/${name}" Name="${name}" PointSize="${style.size}" FontStyle="${style.fontStyle}" FillColor="Color/${style.colour}"${bullets}>${font}</ParagraphStyle>`;
  }).join('');
  const body = `<RootCharacterStyleGroup><CharacterStyle Self="CharacterStyle/$ID/[No character style]" Name="$ID/[No character style]"/></RootCharacterStyleGroup>`
    + `<RootParagraphStyleGroup><ParagraphStyle Self="ParagraphStyle/$ID/[No paragraph style]" Name="$ID/[No paragraph style]" PointSize="9" FillColor="Color/Black">${font}</ParagraphStyle>${styles}</RootParagraphStyleGroup>`
    + '<RootCellStyleGroup><CellStyle Self="CellStyle/$ID/[None]" Name="$ID/[None]"/></RootCellStyleGroup>'
    + '<RootTableStyleGroup><TableStyle Self="TableStyle/$ID/[Basic Table]" Name="$ID/[Basic Table]"/></RootTableStyleGroup>'
    + '<RootObjectStyleGroup><ObjectStyle Self="ObjectStyle/$ID/[None]" Name="$ID/[None]" FillColor="Swatch/None" StrokeColor="Swatch/None" StrokeWeight="0" AppliedParagraphStyle="ParagraphStyle/$ID/[No paragraph style]"/></RootObjectStyleGroup>';
  return { path: 'Resources/Styles.xml', content: part('Styles', body) };
}

function preferencesPart(box: PageBox, bleedMm: number): IdmlPart {
  const bleed = bleedMm * MM_TO_PT;
  return { path: 'Resources/Preferences.xml', content: part('Preferences', `<DocumentPreference PageHeight="${box.heightPt}" PageWidth="${box.widthPt}" FacingPages="false" DocumentBleedTopOffset="${bleed}" DocumentBleedBottomOffset="${bleed}" DocumentBleedInsideOrLeftOffset="${bleed}" DocumentBleedOutsideOrRightOffset="${bleed}"/>`) };
}

function designMap(input: { readonly title: string; readonly spreads: readonly IdmlPart[] }): IdmlPart {
  const refs = [
    '<idPkg:Graphic src="Resources/Graphic.xml"/>', '<idPkg:Fonts src="Resources/Fonts.xml"/>', '<idPkg:Styles src="Resources/Styles.xml"/>', '<idPkg:Preferences src="Resources/Preferences.xml"/>',
    '<idPkg:Tags src="XML/Tags.xml"/>', `<idPkg:MasterSpread src="MasterSpreads/MasterSpread_${MASTER}.xml"/>`,
    ...input.spreads.map((spread) => `<idPkg:Spread src="${spread.path}"/>`),
    `<idPkg:Story src="Stories/Story_${BODY_STORY}.xml"/>`, `<idPkg:Story src="Stories/Story_${FOOTER_STORY}.xml"/>`, '<idPkg:BackingStory src="XML/BackingStory.xml"/>',
  ].join('');
  const head = `${XML_HEAD}<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="20.0(32)"?>\n`;
  const attributes = `xmlns:idPkg="${PACKAGING_NS}" DOMVersion="${DOM_VERSION}" Self="d" StoryList="${BODY_STORY} ${FOOTER_STORY}" Name="${escapeXml(input.title)}.indd" CMYKProfile="Coated FOGRA39 (ISO 12647-2:2004)" RGBProfile="sRGB IEC61966-2.1"`;
  return { path: 'designmap.xml', content: `${head}<Document ${attributes}>${refs}</Document>` };
}

function fixedParts(): readonly IdmlPart[] {
  return [
    { path: 'META-INF/container.xml', content: `${XML_HEAD}<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="designmap.xml" media-type="text/xml"/></rootfiles></container>` },
    { path: 'XML/BackingStory.xml', content: part('BackingStory', '<XmlStory Self="BackingStory" AppliedXMLTag="XMLTag/$ID/Root"/>') },
    { path: 'XML/Tags.xml', content: part('Tags', '<XMLTag Self="XMLTag/$ID/Root" Name="Root"/>') },
  ];
}

/** Όλα τα μέρη εκτός από το `mimetype`, που γράφεται πρώτο και ασυμπίεστο από τη συσκευασία. */
export function idmlParts(input: IdmlInput): readonly IdmlPart[] {
  const { document } = input;
  const box = pageBoxOf(document);
  let sequence = 0;
  const ctx: StoryContext = { nextId: () => { sequence += 1; return `u${sequence.toString(16)}`; }, images: input.images, areaPt: box.widthPt - 2 * box.marginPt };
  const pageCount = Math.max(1, input.pageCount);
  const spreads = Array.from({ length: pageCount }, (_, index) => spreadPart(index, pageCount, box));
  return [
    designMap({ title: document.title, spreads }),
    ...fixedParts(),
    graphicPart(document), fontsPart(document), stylesPart(document), preferencesPart(box, document.page.bleedMm),
    masterPart(box), ...spreads,
    storyPart(BODY_STORY, bodyStoryXml(document, ctx)), storyPart(FOOTER_STORY, footerStoryXml(document.footer)),
  ];
}
