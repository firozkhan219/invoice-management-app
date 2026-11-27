import { inflateRawSync } from "node:zlib";

/**
 * Reads the first sheet of an .xlsx workbook or a .csv file into rows of trimmed strings.
 * Small and dependency-free: enough for product lists typed in Excel, Google Sheets or LibreOffice.
 */
export function readSpreadsheet(data: Buffer, fileName: string): string[][] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xls")) {
    throw new Error("Old .xls files are not supported. In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV, then upload that.");
  }
  const isZip = data.length > 4 && data.readUInt32LE(0) === 0x04034b50;
  if (lower.endsWith(".xlsx") || isZip) return readXlsx(data);
  return parseCsv(data.toString("utf8").replace(/^﻿/, ""));
}

/** RFC 4180 CSV: quoted fields, doubled quotes, commas/newlines inside quotes; also ; or tab separated. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const separator = [",", ";", "\t"].sort((a, b) => countOutsideQuotes(firstLine, b) - countOutsideQuotes(firstLine, a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === "\"" && field === "") {
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return cleanRows(rows);
}

function countOutsideQuotes(line: string, char: string): number {
  let count = 0;
  let quoted = false;
  for (const c of line) {
    if (c === "\"") quoted = !quoted;
    else if (c === char && !quoted) count += 1;
  }
  return count;
}

function cleanRows(rows: string[][]): string[][] {
  return rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}

/* ---------- .xlsx (Office Open XML) ---------- */

function readXlsx(data: Buffer): string[][] {
  const files = unzip(data);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml"));
  const sheetPath = firstSheetPath(files) ?? "xl/worksheets/sheet1.xml";
  const sheet = files.get(sheetPath);
  if (!sheet) throw new Error("The workbook has no worksheet.");

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    let nextIndex = 0;
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : nextIndex;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      let value = "";
      if (type === "s") {
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        value = v !== undefined ? sharedStrings[Number(v)] ?? "" : "";
      } else if (type === "inlineStr") {
        value = textRuns(body);
      } else {
        value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
        if (type === "b") value = value === "1" ? "true" : "false";
      }
      cells[index] = value;
      nextIndex = index + 1;
    }
    rows.push(Array.from({ length: cells.length }, (_, i) => cells[i] ?? ""));
  }
  return cleanRows(rows);
}

function firstSheetPath(files: Map<string, string>): string | null {
  const workbook = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) return null;
  const relId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook)?.[1];
  if (!relId) return null;
  const target = new RegExp(`<Relationship\\b[^>]*\\bId="${relId}"[^>]*\\bTarget="([^"]+)"`).exec(rels)?.[1]
    ?? new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${relId}"`).exec(rels)?.[1];
  if (!target) return null;
  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g), (match) => textRuns(match[1]));
}

/** Joins every <t> run in a string item, ignoring phonetic (<rPh>) text. */
function textRuns(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  return Array.from(withoutPhonetic.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g), (match) => decodeXml(match[1])).join("");
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Minimal zip reader (central directory + stored/deflate entries), enough for .xlsx. */
function unzip(data: Buffer): Map<string, string> {
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i -= 1) {
    if (data.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file is not a valid .xlsx workbook.");

  const entries = data.readUInt16LE(eocd + 10);
  let offset = data.readUInt32LE(eocd + 16);
  const files = new Map<string, string>();

  for (let i = 0; i < entries; i += 1) {
    if (data.readUInt32LE(offset) !== 0x02014b50) throw new Error("This .xlsx workbook is damaged.");
    const method = data.readUInt16LE(offset + 10);
    const compressedSize = data.readUInt32LE(offset + 20);
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const localOffset = data.readUInt32LE(offset + 42);
    const name = data.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    // Only the XML parts are needed; skip images and other binaries.
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
    const localNameLength = data.readUInt16LE(localOffset + 26);
    const localExtraLength = data.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = data.subarray(start, start + compressedSize);
    const content = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (content) files.set(name, content.toString("utf8"));
  }
  return files;
}
