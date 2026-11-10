// Writes a one-sheet Excel file (.xlsx) without dependencies.
// An .xlsx file is a zip archive of a few XML files; this module writes both the
// XML and the zip. Text cells only, a bold header row with filters, a frozen
// header, fixed column widths, and wrapped text.

import zlib from "node:zlib";

export type SheetOptions = {
  sheetName: string;
  columnWidths: number[]; // in characters, one per column
};

function escapeXml(text: string): string {
  return (
    text
      // Control characters other than tab and newline are not allowed in XML.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
}

// Column letters: 0 -> A, 25 -> Z, 26 -> AA.
export function columnName(index: number): string {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

// Excel refuses cells longer than 32,767 characters.
const MAX_CELL = 32_000;

export function sheetXml(rows: string[][], options: SheetOptions): string {
  const width = Math.max(1, rows[0]?.length ?? 1);
  const filterRef = `A1:${columnName(width - 1)}${rows.length}`;
  const cols = options.columnWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  const body = rows
    .map((row, r) => {
      const style = r === 0 ? 1 : 2; // 1: bold header, 2: wrapped text
      const cells = row
        .map((value, c) => {
          const text = escapeXml(value.slice(0, MAX_CELL));
          return `<c r="${columnName(c)}${r + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
    cols ? `<cols>${cols}</cols>` : "",
    `<sheetData>${body}</sheetData>`,
    rows.length > 1 ? `<autoFilter ref="${filterRef}"/>` : "",
    "</worksheet>",
  ].join("");
}

const STYLES = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>',
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>',
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  "</styleSheet>",
].join("");

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";

function workbookFiles(rows: string[][], options: SheetOptions): Record<string, string> {
  const sheetName = escapeXml(options.sheetName.slice(0, 31));
  const width = Math.max(1, rows[0]?.length ?? 1);
  // Excel expects the filter range also as a hidden defined name, in absolute form ($A$1:$M$5).
  const filterName =
    rows.length > 1
      ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheetName}'!$A$1:$${columnName(width - 1)}$${rows.length}</definedName></definedNames>`
      : "";
  return {
    "[Content_Types].xml":
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      `<Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/></Types>`,
    "_rels/.rels":
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml":
      `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">` +
      `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>${filterName}</workbook>`,
    "xl/_rels/workbook.xml.rels":
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    "xl/styles.xml": STYLES,
    "xl/worksheets/sheet1.xml": sheetXml(rows, options),
  };
}

// A minimal zip writer (deflate, no zip64): enough for a few small files.
export function zip(files: Record<string, string | Buffer>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // Fixed timestamp (1980-01-01, the earliest a zip can hold).
  const DOS_TIME = 0;
  const DOS_DATE = (1 << 5) | 1;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const compressed = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data);
    const nameBytes = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, compressed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0); // central directory entry
    entry.writeUInt16LE(20, 4); // version made by
    entry.writeUInt16LE(20, 6); // version needed to extract
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42); // where the local header starts
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }
  const count = Object.keys(files).length;
  const centralSize = central.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

export function xlsx(rows: string[][], options: SheetOptions): Buffer {
  return zip(workbookFiles(rows, options));
}
