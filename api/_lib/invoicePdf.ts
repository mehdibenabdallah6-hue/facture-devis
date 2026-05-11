import { escapeHtml, sanitizeText } from './validators.js';

type InvoicePdfInput = {
  invoice: any;
  company: any;
};

type NormalizedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  totalHT: number;
  totalVAT: number;
  totalTTC: number;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;

export async function generateInvoicePdfAttachment(input: InvoicePdfInput): Promise<{ filename: string; content: string }> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0.91, 0.32, 0.1);
  const ink = rgb(0.12, 0.11, 0.1);
  const muted = rgb(0.39, 0.45, 0.52);
  const border = rgb(0.9, 0.88, 0.84);
  const soft = rgb(1, 0.97, 0.93);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const invoice = input.invoice || {};
  const company = input.company || {};
  const lines = normalizeLines(invoice.items || []);
  const totals = normalizeTotals(invoice, lines);
  const label = documentLabel(invoice.type);
  const number = safePdfText(invoice.number || invoice.draftNumber || 'sans numero');
  const companyName = safePdfText(company.name || company.legalName || 'Votre artisan');
  const clientName = safePdfText(invoice.clientName || 'Client');

  const drawText = (text: unknown, x: number, atY: number, size = 10, options: any = {}) => {
    page.drawText(safePdfText(text), {
      x,
      y: atY,
      size,
      font: options.bold ? bold : regular,
      color: options.color || ink,
      maxWidth: options.maxWidth,
    });
  };

  const drawRight = (text: unknown, x: number, atY: number, size = 10, options: any = {}) => {
    const value = safePdfText(text);
    const font = options.bold ? bold : regular;
    page.drawText(value, {
      x: x - font.widthOfTextAtSize(value, size),
      y: atY,
      size,
      font,
      color: options.color || ink,
    });
  };

  const wrap = (text: unknown, maxWidth: number, size = 10) => wrapText(safePdfText(text), maxWidth, size, regular);
  const ensureSpace = (needed: number) => {
    if (y - needed > 72) return;
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
    drawText(`${label} ${number}`, MARGIN, y, 10, { bold: true, color: muted });
    y -= 28;
  };

  page.drawRectangle({ x: 0, y: A4[1] - 18, width: A4[0], height: 18, color: orange });
  page.drawRectangle({ x: MARGIN, y: A4[1] - 126, width: A4[0] - MARGIN * 2, height: 84, color: soft, borderColor: border, borderWidth: 1 });
  drawText(companyName, MARGIN + 18, y - 16, 18, { bold: true });
  drawText('Document prepare avec Photofacto', MARGIN + 18, y - 36, 9, { color: muted });
  drawRight(label.toUpperCase(), A4[0] - MARGIN - 18, y - 14, 22, { bold: true, color: orange });
  drawRight(number, A4[0] - MARGIN - 18, y - 38, 11, { bold: true });
  y -= 122;

  drawText('Emetteur', MARGIN, y, 10, { bold: true, color: orange });
  drawText('Client', 330, y, 10, { bold: true, color: orange });
  y -= 18;

  const companyLines = [
    companyName,
    company.address,
    company.siret ? `SIRET : ${company.siret}` : '',
    company.vatNumber ? `TVA : ${company.vatNumber}` : '',
    company.email,
    company.phone,
  ].filter(Boolean);
  const clientLines = [
    clientName,
    invoice.clientEmail,
    invoice.clientAddress || invoice.billingAddress,
  ].filter(Boolean);
  const blockStart = y;
  companyLines.forEach((line, index) => drawText(line, MARGIN, blockStart - index * 13, 9, { color: index === 0 ? ink : muted, bold: index === 0 }));
  clientLines.forEach((line, index) => drawText(line, 330, blockStart - index * 13, 9, { color: index === 0 ? ink : muted, bold: index === 0 }));
  y -= Math.max(companyLines.length, clientLines.length, 3) * 13 + 18;

  drawText(`Date : ${formatDate(invoice.date)}`, MARGIN, y, 9, { color: muted });
  drawText(`Echeance : ${formatDate(invoice.dueDate)}`, 190, y, 9, { color: muted });
  if (invoice.paymentMethod) drawText(`Paiement : ${invoice.paymentMethod}`, 360, y, 9, { color: muted });
  y -= 32;

  page.drawRectangle({ x: MARGIN, y: y - 12, width: A4[0] - MARGIN * 2, height: 24, color: rgb(0.13, 0.12, 0.11) });
  drawText('Description', MARGIN + 10, y - 4, 9, { bold: true, color: rgb(1, 1, 1) });
  drawRight('Qté', 368, y - 4, 9, { bold: true, color: rgb(1, 1, 1) });
  drawRight('PU HT', 448, y - 4, 9, { bold: true, color: rgb(1, 1, 1) });
  drawRight('Total HT', A4[0] - MARGIN - 10, y - 4, 9, { bold: true, color: rgb(1, 1, 1) });
  y -= 30;

  lines.forEach((line, index) => {
    const descriptionLines = wrap(line.description || `Ligne ${index + 1}`, 260, 9);
    const rowHeight = Math.max(24, descriptionLines.length * 11 + 12);
    ensureSpace(rowHeight + 10);
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight + 8,
      width: A4[0] - MARGIN * 2,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.985, 0.98, 0.965),
      borderColor: border,
      borderWidth: 0.4,
    });
    descriptionLines.forEach((part, lineIndex) => drawText(part, MARGIN + 10, y - 8 - lineIndex * 11, 9));
    drawRight(formatNumber(line.quantity), 368, y - 8, 9);
    drawRight(formatCurrencyPdf(line.unitPrice), 448, y - 8, 9);
    drawRight(formatCurrencyPdf(line.totalHT), A4[0] - MARGIN - 10, y - 8, 9, { bold: true });
    y -= rowHeight;
  });

  y -= 18;
  ensureSpace(120);
  const totalsX = 340;
  const totalsW = A4[0] - MARGIN - totalsX;
  page.drawRectangle({ x: totalsX, y: y - 96, width: totalsW, height: 106, color: soft, borderColor: border, borderWidth: 1 });
  drawText('Recapitulatif', totalsX + 14, y - 16, 10, { bold: true, color: orange });
  drawRight('Total HT', totalsX + 92, y - 38, 9, { color: muted });
  drawRight(formatCurrencyPdf(totals.totalHT), A4[0] - MARGIN - 14, y - 38, 9, { bold: true });
  drawRight('TVA', totalsX + 92, y - 58, 9, { color: muted });
  drawRight(formatCurrencyPdf(totals.totalVAT), A4[0] - MARGIN - 14, y - 58, 9, { bold: true });
  drawRight('Total TTC', totalsX + 92, y - 82, 11, { bold: true, color: orange });
  drawRight(formatCurrencyPdf(totals.totalTTC), A4[0] - MARGIN - 14, y - 82, 12, { bold: true, color: orange });

  if (invoice.notes) {
    const noteLines = wrap(`Note : ${invoice.notes}`, 260, 9);
    noteLines.slice(0, 6).forEach((line, index) => drawText(line, MARGIN, y - 20 - index * 12, 9, { color: muted }));
  }

  drawText('Photofacto - PDF genere cote serveur depuis les donnees validees du compte.', MARGIN, 34, 8, { color: muted });
  const pdfBytes = await pdf.save();
  return {
    filename: `${filenamePrefix(invoice.type)}_${sanitizeFilename(invoice.number || invoice.draftNumber || 'document')}.pdf`,
    content: Buffer.from(pdfBytes).toString('base64'),
  };
}

function normalizeLines(items: any[]): NormalizedLine[] {
  const lines = Array.isArray(items) ? items : [];
  return lines.map((item, index) => {
    const quantity = finiteNumber(item.quantity, 1);
    const unitPrice = finiteNumber(item.unitPrice ?? item.price ?? item.unitAmount, 0);
    const vatRate = finiteNumber(item.vatRate ?? item.tvaRate, 0);
    const totalHT = finiteNumber(item.totalHT, round2(quantity * unitPrice));
    const totalVAT = finiteNumber(item.totalVAT ?? item.totalTVA, round2(totalHT * vatRate / 100));
    return {
      description: sanitizeText(item.description || item.name || `Ligne ${index + 1}`, 500),
      quantity,
      unitPrice,
      vatRate,
      totalHT,
      totalVAT,
      totalTTC: round2(totalHT + totalVAT),
    };
  });
}

function normalizeTotals(invoice: any, lines: NormalizedLine[]) {
  const fallbackHT = round2(lines.reduce((sum, line) => sum + line.totalHT, 0));
  const fallbackVAT = round2(lines.reduce((sum, line) => sum + line.totalVAT, 0));
  return {
    totalHT: finiteNumber(invoice.totalHT, fallbackHT),
    totalVAT: finiteNumber(invoice.totalVAT ?? invoice.totalTVA, fallbackVAT),
    totalTTC: finiteNumber(invoice.totalTTC, round2(fallbackHT + fallbackVAT)),
  };
}

function wrapText(text: string, maxWidth: number, size: number, font: any): string[] {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function safePdfText(value: unknown): string {
  return escapeHtml(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/€/g, 'EUR')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

function finiteNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
}

function formatCurrencyPdf(value: number) {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} EUR`;
}

function formatDate(value: unknown) {
  const time = Date.parse(String(value || ''));
  if (!Number.isFinite(time)) return '-';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(time));
}

function documentLabel(type: unknown) {
  if (type === 'quote') return 'Devis';
  if (type === 'credit') return 'Avoir';
  if (type === 'deposit') return "Facture d'acompte";
  return 'Facture';
}

function filenamePrefix(type: unknown) {
  if (type === 'quote') return 'Devis';
  if (type === 'credit') return 'Avoir';
  return 'Facture';
}

function sanitizeFilename(value: unknown) {
  return sanitizeText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';
}
