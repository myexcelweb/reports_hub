// One exporter for every report.
//
// Reports are exported from their on-screen <table> elements, so the Excel /
// PDF file always matches what the user sees — merged (two-row) headers,
// GRAND TOTAL rows, red/green category colours and R/U coloured case numbers
// included. Excel is written with ExcelJS (SheetJS Community can't write any
// styling); PDF with jsPDF + jspdf-autotable.
//
// Table model used by both writers:
//   { title, sheetName?, reportTitle?, autoFilter?, head: Cell[][], body: Cell[][], foot: Cell[][] }
//   Cell = { text, value, colSpan, rowSpan, align, bold, color, runs }

import { downloadBlob } from './exportFile';

const NAVY = '0F1E35';
const TEXT = '1A202C';
const MUTED = '64748B';
const GRID = 'CBD5E1';
const ZEBRA = 'F4F7FA';
const FOOT = 'E2E8F0';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ─── Reading tables from the DOM ─────────────────────────────────────────────

const NAMED_COLORS = { red: 'FF0000', green: '008000', blue: '0000FF', black: '000000', orange: 'FFA500' };

function toHex(color) {
  if (!color) return null;
  const c = String(color).trim().toLowerCase();
  if (NAMED_COLORS[c]) return NAMED_COLORS[c];
  let m = c.match(/^#([0-9a-f]{3})$/);
  if (m) return m[1].split('').map(ch => ch + ch).join('').toUpperCase();
  m = c.match(/^#([0-9a-f]{6})$/);
  if (m) return m[1].toUpperCase();
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

// Only colours set explicitly with style="color: …" count (category red/green,
// R/U numbers). Bootstrap link-button blue is deliberately ignored.
function inlineColor(node, stop) {
  for (let el = node; el; el = el.parentElement) {
    if (el.style && el.style.color) return toHex(el.style.color);
    if (el === stop) break;
  }
  return null;
}

function isBold(node, stop) {
  for (let el = node; el; el = el.parentElement) {
    if (['STRONG', 'B', 'TH'].includes(el.tagName)) return true;
    if (el.classList && el.classList.contains('fw-bold')) return true;
    const fw = el.style && el.style.fontWeight;
    if (fw && (fw === 'bold' || Number(fw) >= 600)) return true;
    if (el === stop) break;
  }
  return false;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

function readCell(el) {
  const runs = [];
  const doc = el.ownerDocument;
  const walker = doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.replace(/\s+/g, ' ');
    if (!text) continue;
    const color = inlineColor(n.parentElement, el);
    const bold = isBold(n.parentElement, el);
    const last = runs[runs.length - 1];
    if (last && last.color === color && last.bold === bold) last.text += text;
    else runs.push({ text, color, bold });
  }
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, '');
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
  }
  const text = runs.map(r => r.text).join('').replace(/\s+/g, ' ').trim();
  const numeric = NUMERIC.test(text);
  const mixed = new Set(runs.filter(r => r.text.trim()).map(r => `${r.color}|${r.bold}`)).size > 1;
  const cls = el.classList;
  const explicitAlign = cls.contains('text-center') || cls.contains('text-end');
  return {
    explicitAlign,
    text,
    value: numeric ? Number(text) : text,
    colSpan: el.colSpan || 1,
    rowSpan: el.rowSpan || 1,
    align: cls.contains('text-center') || numeric ? 'center' : cls.contains('text-end') ? 'right' : 'left',
    bold: runs.length > 0 && runs.every(r => r.bold || !r.text.trim()),
    color: mixed ? null : (runs.find(r => r.text.trim())?.color || null),
    runs: mixed ? runs.filter(r => r.text) : null,
  };
}

/** Read one <table> element into the table model. */
export function tableFromElement(tableEl, title) {
  const out = { title, head: [], body: [], foot: [] };
  tableEl.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr').forEach(tr => {
    if (tr.hasAttribute('data-export-skip')) return;
    const tag = tr.parentElement.tagName;
    const part = tag === 'THEAD' ? 'head' : tag === 'TFOOT' ? 'foot' : 'body';
    const cells = [...tr.children].filter(c => c.tagName === 'TD' || c.tagName === 'TH').map(readCell);
    if (cells.length) out[part].push(cells);
  });
  alignMixedColumns(out);
  return out;
}

// In a column that holds text (e.g. Balance Sheet "Case Numbers": "1, 2"),
// a lone number like "1" should line up with the text, not jump to centre.
function alignMixedColumns(table) {
  const { placed } = layout(table);
  const textCols = new Set();
  placed.forEach(({ c, part, cell }) => {
    if (part === 'body' && cell.colSpan === 1 && cell.text && !NUMERIC.test(cell.text)) textCols.add(c);
  });
  placed.forEach(({ c, part, cell }) => {
    if (part !== 'head' && textCols.has(c) && NUMERIC.test(cell.text) && !cell.explicitAlign) {
      cell.align = 'left';
      cell.value = cell.text;
    }
  });
}

/**
 * Collect every exportable table inside a report container.
 * Title comes from data-export-title on the <table>, else the report title.
 */
export function collectTables(container, fallbackTitle = '') {
  if (!container) return [];
  return [...container.querySelectorAll('table')]
    .filter(t => !t.closest('[data-export-skip]'))
    .map(t => ({
      ...tableFromElement(t, t.dataset.exportTitle || fallbackTitle),
      sheetName: t.dataset.exportSheet || undefined,
      autoFilter: t.hasAttribute('data-export-autofilter'),
    }))
    .filter(t => t.head.length + t.body.length + t.foot.length > 0);
}

/** Build a table from plain row objects (All Data). */
export function tableFromRows(columns, rows, getValue, title) {
  const cell = (value, extra = {}) => {
    const v = value === null || value === undefined ? '' : value;
    const text = String(v);
    return { text, value: v, colSpan: 1, rowSpan: 1, align: typeof v === 'number' ? 'center' : 'left', bold: false, color: null, runs: null, ...extra };
  };
  return {
    title,
    autoFilter: true,
    head: [columns.map(c => cell(c, { align: 'center', bold: true }))],
    body: rows.map(row => columns.map(c => cell(getValue(row, c)))),
    foot: [],
  };
}

// ─── Grid layout (resolves colspan / rowspan into positions) ─────────────────

function layout(table) {
  const rows = [
    ...table.head.map(cells => ({ part: 'head', cells })),
    ...table.body.map(cells => ({ part: 'body', cells })),
    ...table.foot.map(cells => ({ part: 'foot', cells })),
  ];
  const occupied = [];
  const placed = [];
  let bodyIndex = -1;
  rows.forEach(({ part, cells }, r) => {
    if (part === 'body') bodyIndex++;
    let c = 0;
    cells.forEach(cell => {
      while (occupied[r] && occupied[r][c]) c++;
      placed.push({ r, c, part, bodyIndex, cell });
      for (let i = 0; i < cell.rowSpan; i++) {
        for (let j = 0; j < cell.colSpan; j++) {
          (occupied[r + i] ??= [])[c + j] = true;
        }
      }
      c += cell.colSpan;
    });
  });
  const width = occupied.reduce((w, row) => Math.max(w, row ? row.length : 0), 0);
  return { placed, width, height: rows.length, headRows: table.head.length };
}

export function tableWidth(table) {
  return layout(table).width;
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function generatedStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function safeSheetName(name, used) {
  const base = String(name || 'Sheet').replace(/[:\\/?*[\]]/g, '-').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

// ─── Excel (ExcelJS) ─────────────────────────────────────────────────────────

const thin = { style: 'thin', color: { argb: 'FF' + GRID } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });

function writeSheet(wb, table, sheetName, meta) {
  const { placed, width, headRows } = layout(table);
  const cols = Math.max(width, 1);
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9, orientation: 'landscape',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: `&L${(table.reportTitle || meta.reportTitle || '').replace(/&/g, '&&')}&RPage &P of &N` },
  });

  // Title block
  const titleRow = (r, text, font, height) => {
    ws.mergeCells(r, 1, r, cols);
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = font;
    c.alignment = { vertical: 'middle', horizontal: 'left' };
    if (height) ws.getRow(r).height = height;
    return c;
  };
  const top = titleRow(1, table.reportTitle || meta.reportTitle || table.title, { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }, 24);
  top.fill = fill(NAVY);
  let r0 = 2;
  if (table.title && table.title !== (table.reportTitle || meta.reportTitle)) {
    titleRow(r0++, table.title, { bold: true, size: 12, color: { argb: 'FF' + NAVY } }, 18);
  }
  titleRow(r0++, [`Generated: ${generatedStamp()}`, meta.subtitle].filter(Boolean).join('   ·   '),
    { italic: true, size: 9, color: { argb: 'FF' + MUTED } });
  const start = r0 + 1; // blank spacer row, then the table

  // Cells
  const colWidths = new Array(cols).fill(6);
  placed.forEach(({ r, c, part, bodyIndex, cell }) => {
    const row = start + r;
    const col = c + 1;
    if (cell.rowSpan > 1 || cell.colSpan > 1) {
      ws.mergeCells(row, col, row + cell.rowSpan - 1, col + cell.colSpan - 1);
    }
    const xc = ws.getCell(row, col);
    const baseColor = part === 'head' ? 'FFFFFF' : part === 'foot' ? NAVY : TEXT;
    if (cell.runs && part !== 'head') {
      xc.value = {
        richText: cell.runs.map(run => ({
          text: run.text,
          font: { bold: run.bold, size: 10, color: { argb: 'FF' + (run.color || baseColor) } },
        })),
      };
    } else {
      xc.value = cell.value;
    }
    const long = cell.text.length > 60;
    const style = {
      font: { bold: part !== 'body' || cell.bold, size: 10, color: { argb: 'FF' + (part === 'head' ? 'FFFFFF' : cell.color || baseColor) } },
      alignment: {
        vertical: 'middle',
        horizontal: part === 'head' ? 'center' : cell.align,
        wrapText: part === 'head' || long,
      },
      border: allBorders,
    };
    if (part === 'head') style.fill = fill(NAVY);
    else if (part === 'foot') style.fill = fill(FOOT);
    else if (bodyIndex % 2 === 1) style.fill = fill(ZEBRA);
    // Style every cell of a merged range so borders/fills cover the whole block
    for (let i = 0; i < cell.rowSpan; i++) {
      for (let j = 0; j < cell.colSpan; j++) {
        const target = ws.getCell(row + i, col + j);
        target.font = style.font;
        target.alignment = style.alignment;
        target.border = style.border;
        if (style.fill) target.fill = style.fill;
      }
    }
    if (cell.colSpan === 1) {
      const len = Math.min(cell.text.length, 60);
      colWidths[c] = Math.max(colWidths[c], part === 'head' ? Math.min(len, 18) : len);
    }
  });
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = Math.min(w + 3, 64); });

  // Freeze header rows + first column, repeat header rows on every printed page
  if (headRows > 0) {
    ws.views = [{ state: 'frozen', ySplit: start + headRows - 1, xSplit: 1 }];
    ws.pageSetup.printTitlesRow = `${start}:${start + headRows - 1}`;
  }
  if (table.autoFilter && headRows > 0) {
    ws.autoFilter = { from: { row: start + headRows - 1, column: 1 }, to: { row: start + headRows - 1, column: cols } };
  }
  return ws;
}

/**
 * @param {Array} tables  table models (see top of file)
 * @param {{ fileName: string, reportTitle: string, subtitle?: string }} meta
 */
export async function exportTablesToExcel(tables, meta) {
  if (!tables || tables.length === 0) throw new Error('Nothing to export — no tables found.');
  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reports Hub';
  wb.created = new Date();
  const used = new Set();
  tables.forEach(t => writeSheet(wb, t, safeSheetName(t.sheetName || t.title, used), meta));
  const buffer = await wb.xlsx.writeBuffer();
  if (meta.returnBuffer) return buffer;
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), meta.fileName);
  return null;
}

// ─── PDF (jsPDF + autotable) ─────────────────────────────────────────────────

const rgb = (hex) => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));

// Standard PDF fonts only cover Latin-1; map common Unicode punctuation.
function pdfText(s) {
  return String(s ?? '')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[Ā-￿]/g, '?');
}

function fontSizeFor(width) {
  if (width <= 6) return 9.5;
  if (width <= 12) return 9;
  if (width <= 18) return 7.5;
  if (width <= 26) return 6.5;
  return 5.5;
}

function toAutoTableCell(cell, part) {
  const styles = { halign: part === 'head' ? 'center' : cell.align };
  if (part === 'body' && cell.bold) styles.fontStyle = 'bold';
  if (part !== 'head' && cell.color) styles.textColor = rgb(cell.color);
  if (cell.runs && cell.runs.some(r => r.bold)) styles.fontStyle = 'bold';
  return {
    content: pdfText(cell.text),
    colSpan: cell.colSpan,
    rowSpan: cell.rowSpan,
    styles,
    runs: part === 'head' ? null : cell.runs,
  };
}

// Draw a cell whose text has several colours (e.g. green R / red U numbers).
function drawRuns(doc, cell, runs) {
  const left = cell.x + cell.padding('left');
  const maxX = cell.x + cell.width - cell.padding('right');
  const fontSize = cell.styles.fontSize;
  const lineH = (fontSize * doc.getLineHeightFactor());
  let x = left;
  let y = cell.y + cell.padding('top');
  doc.setFontSize(fontSize);
  runs.forEach(run => {
    doc.setFont('helvetica', run.bold ? 'bold' : 'normal');
    doc.setTextColor(...rgb(run.color || TEXT));
    pdfText(run.text).split(/(\s+)/).forEach(tok => {
      if (!tok) return;
      if (/^\s+$/.test(tok)) {
        if (x > left) x += doc.getTextWidth(' ');
        return;
      }
      const w = doc.getTextWidth(tok);
      if (x + w > maxX + 0.5 && x > left) { x = left; y += lineH; }
      doc.text(tok, x, y, { baseline: 'top' });
      x += w;
    });
  });
}

// Minimum width per column = its longest single word, so autotable never
// breaks a word in the middle ("QUERYBUILDE / R"). If the columns can't all
// fit, the font is stepped down until they do (or hits 5pt).
function fitColumns(doc, table, fontSize, available) {
  const { placed } = layout(table);
  const measure = (size) => {
    const pad = size <= 7 ? 2.5 : 3.5;
    const mins = [];
    doc.setFontSize(size);
    placed.forEach(({ c, part, cell }) => {
      if (cell.colSpan !== 1) return;
      doc.setFont('helvetica', part !== 'body' || cell.bold || (cell.runs && cell.runs.some(r => r.bold)) ? 'bold' : 'normal');
      const longest = pdfText(cell.text).split(/\s+/).reduce((w, word) => Math.max(w, doc.getTextWidth(word)), 0);
      mins[c] = Math.max(mins[c] || 0, longest + pad * 2 + 1);
    });
    return { mins, pad };
  };
  let size = fontSize;
  let { mins, pad } = measure(size);
  const total = (m) => m.reduce((s, w) => s + (w || 0), 0);
  while (total(mins) > available && size > 5) {
    size = Math.max(5, size - 0.5);
    ({ mins, pad } = measure(size));
  }
  // Still too wide at the smallest font: shrink every column proportionally
  // so nothing runs off the page (a very long word may then wrap).
  const scale = Math.min(1, available / (total(mins) || 1));
  const columnStyles = {};
  mins.forEach((w, c) => { if (w) columnStyles[c] = { minCellWidth: w * scale }; });
  return { fontSize: size, cellPadding: pad, columnStyles };
}

/**
 * @param {Array} tables  table models
 * @param {{ fileName: string, reportTitle: string, subtitle?: string }} meta
 */
export async function exportTablesToPdf(tables, meta) {
  if (!tables || tables.length === 0) throw new Error('Nothing to export — no tables found.');
  const { jsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');

  const widest = Math.max(...tables.map(tableWidth));
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: widest > 16 ? 'a3' : 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 28;          // side margin
  const TOP = 62;        // content starts below the page header
  const BOTTOM = 36;     // room for the page footer
  const stamp = generatedStamp();

  let y = TOP;
  tables.forEach((table, i) => {
    const fit = fitColumns(doc, table, fontSizeFor(tableWidth(table)), pageW - 2 * M);
    if (i > 0) {
      y = doc.lastAutoTable.finalY + 26;
      if (y > pageH - BOTTOM - 110) { doc.addPage(); y = TOP; }
    }
    if (table.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(...rgb(NAVY));
      doc.text(pdfText(table.title), M, y);
      y += 8;
    }
    autoTable(doc, {
      startY: y,
      head: table.head.map(row => row.map(c => toAutoTableCell(c, 'head'))),
      body: table.body.map(row => row.map(c => toAutoTableCell(c, 'body'))),
      foot: table.foot.map(row => row.map(c => toAutoTableCell(c, 'foot'))),
      theme: 'grid',
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
      columnStyles: fit.columnStyles,
      styles: {
        font: 'helvetica', fontSize: fit.fontSize, cellPadding: fit.cellPadding,
        valign: 'middle', overflow: 'linebreak',
        lineColor: rgb(GRID), lineWidth: 0.5, textColor: rgb(TEXT),
      },
      headStyles: { fillColor: rgb(NAVY), textColor: 255, fontStyle: 'bold', valign: 'middle' },
      footStyles: { fillColor: rgb(FOOT), textColor: rgb(NAVY), fontStyle: 'bold' },
      alternateRowStyles: { fillColor: rgb(ZEBRA) },
      showHead: 'everyPage',
      showFoot: 'lastPage',
      rowPageBreak: 'avoid',
      willDrawCell: (data) => {
        if (data.cell.raw && data.cell.raw.runs) data.cell.text = [];
      },
      didDrawCell: (data) => {
        if (data.cell.raw && data.cell.raw.runs) drawRuns(doc, data.cell, data.cell.raw.runs);
      },
    });
  });

  // Page header + footer on every page (done last so "Page X of Y" is known)
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...rgb(NAVY));
    doc.rect(0, 0, pageW, 38, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(pdfText(meta.reportTitle), M, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(pdfText([meta.subtitle, `Generated: ${stamp}`].filter(Boolean).join('   ·   ')), pageW - M, 24, { align: 'right' });

    doc.setDrawColor(...rgb(GRID));
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 24, pageW - M, pageH - 24);
    doc.setFontSize(8);
    doc.setTextColor(...rgb(MUTED));
    doc.text('Reports Hub', M, pageH - 12);
    doc.text(`Page ${p} of ${pages}`, pageW - M, pageH - 12, { align: 'right' });
  }

  if (meta.returnBuffer) return doc.output('arraybuffer');
  doc.save(meta.fileName);
  return null;
}

/** Export every table inside a report container. type: 'excel' | 'pdf'. */
export async function exportReportElement(type, container, meta) {
  const tables = collectTables(container, meta.reportTitle);
  return type === 'excel' ? exportTablesToExcel(tables, meta) : exportTablesToPdf(tables, meta);
}
