// Minimal SpreadsheetML workbook in an uncompressed ZIP, per ECMA-376.
// Inline-string cells keep user-entered text (including "=") from becoming formulas.
type Sheet = { name: string; rows: (string | number)[][] };
const encoder = new TextEncoder();
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function column(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : column(Math.floor(index / 26) - 1) + column(index % 26);
}
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
function worksheet(sheet: Sheet) {
  if (sheet.rows.length > 1_048_576) throw new Error("Too many rows for an Excel sheet.");
  const width = sheet.rows.reduce((maximum, row) => Math.max(maximum, row.length), 1);
  return declaration + `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${width}" width="28" customWidth="1"/></cols><sheetData>` +
    sheet.rows.map((row, index) => `<row r="${index + 1}">` + row.map((value, cell) => {
      const address = `${column(cell)}${index + 1}`;
      if (typeof value === "number" && Number.isFinite(value)) return `<c r="${address}" s="${index === 0 ? 1 : 0}"><v>${value}</v></c>`;
      const string = String(value);
      if (string.length > 32767) throw new Error("A text field exceeds Excel's 32,767-character cell limit. Shorten it before exporting.");
      return `<c r="${address}" t="inlineStr" s="${index === 0 ? 1 : 0}"><is><t xml:space="preserve">${xml(string)}</t></is></c>`;
    }).join("") + "</row>").join("") +
    `</sheetData><autoFilter ref="A1:${column(width - 1)}${sheet.rows.length}"/></worksheet>`;
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size: number) {
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  return { bytes, u16: (offset: number, value: number) => view.setUint16(offset, value, true),
    u32: (offset: number, value: number) => view.setUint32(offset, value, true) };
}
function zip(files: { path: string; text: string }[]) {
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = encoder.encode(file.path), data = encoder.encode(file.text), crc = crc32(data);
    const local = header(30);
    local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x800); local.u16(12, 33);
    local.u32(14, crc); local.u32(18, data.length); local.u32(22, data.length); local.u16(26, name.length);
    parts.push(local.bytes, name, data);
    const directory = header(46);
    directory.u32(0, 0x02014b50); directory.u16(4, 20); directory.u16(6, 20);
    directory.u16(8, 0x800); directory.u16(14, 33); directory.u32(16, crc);
    directory.u32(20, data.length); directory.u32(24, data.length); directory.u16(28, name.length); directory.u32(42, offset);
    central.push(directory.bytes, name); centralSize += 46 + name.length;
    offset += 30 + name.length + data.length;
  }
  const end = header(22);
  end.u32(0, 0x06054b50); end.u16(8, files.length); end.u16(10, files.length);
  end.u32(12, centralSize); end.u32(16, offset);
  const result = new Uint8Array(offset + centralSize + 22);
  let cursor = 0;
  for (const part of [...parts, ...central, end.bytes]) { result.set(part, cursor); cursor += part.length; }
  return result;
}
export function buildWorkbook(sheets: Sheet[]): Uint8Array<ArrayBuffer> {
  const files = [
    { path: "[Content_Types].xml", text: declaration + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>` },
    { path: "_rels/.rels", text: declaration + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { path: "xl/workbook.xml", text: declaration + `<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
    { path: "xl/_rels/workbook.xml.rels", text: declaration + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/></Relationships>` },
    { path: "xl/styles.xml", text: declaration + `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((sheet, i) => ({ path: `xl/worksheets/sheet${i + 1}.xml`, text: worksheet(sheet) })),
  ];
  return zip(files);
}
export function downloadReport(bytes: Uint8Array<ArrayBuffer>, month: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = `PharmaMRP-${month}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
