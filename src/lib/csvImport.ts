/**
 * Robust CSV import utility for parsing bank/wallet statement CSV files.
 *
 * Supports:
 * - Auto-detection of column headers (date, description, amount, etc.)
 * - Multiple date formats (ISO, US, European, with/without time)
 * - Quoted CSV fields with embedded commas
 * - Various amount formats ($, parentheses for negatives, comma separators)
 * - Both USD and sats denominations
 * - Flexible column ordering
 */

export interface ParsedCSVTransaction {
  date: string; // ISO 8601 date string
  description: string;
  amount: number; // Always positive (absolute value)
  isIncome: boolean;
  rawAmount: number; // Original signed amount from CSV
}

export interface CSVParseResult {
  transactions: ParsedCSVTransaction[];
  totalRows: number;
  skippedRows: number;
  errors: string[];
  detectedColumns: {
    date?: string;
    description?: string;
    amount?: string;
  };
}

/**
 * Parse a single CSV line, properly handling quoted fields with embedded commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      continue;
    }

    if (inQuotes && char === quoteChar) {
      // Check for escaped quote (double quote)
      if (line[i + 1] === quoteChar) {
        current += quoteChar;
        i++;
        continue;
      }
      inQuotes = false;
      quoteChar = '';
      continue;
    }

    if (!inQuotes && char === ',') {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

/**
 * Normalize a header name for comparison.
 */
function normalizeHeader(name: string): string {
  return name.toLowerCase().trim().replace(/[\s_\-]+/g, '');
}

/**
 * Detect which column is the date, description, and amount columns
 * based on header names.
 */
function detectColumns(headers: string[]): {
  dateIdx: number;
  descriptionIdx: number;
  amountIdx: number;
  dateHeader?: string;
  descriptionHeader?: string;
  amountHeader?: string;
} {
  const normalized = headers.map(normalizeHeader);

  // Date column detection
  const datePatterns = ['date', 'transactiondate', 'postdate', 'posteddate', 'datetime', 'time', 'created', 'settled'];
  let dateIdx = normalized.findIndex(h => datePatterns.some(p => h === p || h.includes(p)));

  // Description column detection
  const descPatterns = ['description', 'desc', 'memo', 'details', 'name', 'merchant', 'payee', 'narration', 'note', 'transaction'];
  let descriptionIdx = normalized.findIndex(h => descPatterns.some(p => h === p || h.includes(p)));

  // Amount column detection
  const amountPatterns = ['amount', 'amt', 'value', 'total', 'debit', 'credit', 'price', 'sum', 'amountusd', 'amountsats'];
  let amountIdx = normalized.findIndex(h => amountPatterns.some(p => h === p || h.includes(p)));

  // Fallback: if we have exactly 3 columns, assume date, description, amount
  if (headers.length >= 3) {
    if (dateIdx === -1) dateIdx = 0;
    if (descriptionIdx === -1) descriptionIdx = descriptionIdx !== -1 ? descriptionIdx : (dateIdx === 0 ? 1 : 0);
    if (amountIdx === -1) {
      // Find a column that's not date or description
      for (let i = 0; i < headers.length; i++) {
        if (i !== dateIdx && i !== descriptionIdx) {
          amountIdx = i;
          break;
        }
      }
    }
  }

  // Last resort: assume standard order
  if (dateIdx === -1) dateIdx = 0;
  if (descriptionIdx === -1) descriptionIdx = Math.min(1, headers.length - 1);
  if (amountIdx === -1) amountIdx = Math.min(2, headers.length - 1);

  return {
    dateIdx,
    descriptionIdx,
    amountIdx,
    dateHeader: headers[dateIdx],
    descriptionHeader: headers[descriptionIdx],
    amountHeader: headers[amountIdx],
  };
}

/**
 * Parse various date formats into an ISO 8601 string.
 * Handles:
 * - 2024-01-15 / 2024-1-5
 * - 01/15/2024 / 1/5/2024 (US format: MM/DD/YYYY)
 * - 15/01/2024 (European format: DD/MM/YYYY - heuristic: if first part > 12, it's European)
 * - Jan 15, 2024 / January 15, 2024
 * - 2024-01-15T10:30:00
 * - Unix timestamps (seconds or milliseconds)
 */
function parseDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Already ISO format
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/);
  if (isoMatch) {
    const [, year, month, day, time] = isoMatch;
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${time || 'T12:00:00.000Z'}`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // US format: MM/DD/YYYY or M/D/YYYY (with optional time)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(\s+.*)?$/);
  if (slashMatch) {
    let [, part1, part2, year, time] = slashMatch;
    let month, day;

    const num1 = parseInt(part1);
    const num2 = parseInt(part2);

    // Heuristic: if first number > 12, it must be a day (European format DD/MM)
    if (num1 > 12 && num2 <= 12) {
      day = num1;
      month = num2;
    } else {
      // Default to US format: MM/DD
      month = num1;
      day = num2;
    }

    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(`${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // European format with dots: DD.MM.YYYY
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dotMatch) {
    let [, day, month, year] = dotMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const date = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // Month name format: Jan 15, 2024 / January 15, 2024 / 15 Jan 2024
  const monthNameMatch = trimmed.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monthNameMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // Day Month Year: 15 Jan 2024
  const dayMonthMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (dayMonthMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // Unix timestamp (seconds or milliseconds)
  const numMatch = trimmed.match(/^(\d{10,13})$/);
  if (numMatch) {
    const num = parseInt(trimmed);
    const date = new Date(num < 1e12 ? num * 1000 : num);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  // Last resort: try the Date constructor
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date.toISOString();

  return null;
}

/**
 * Parse an amount string into a number.
 * Handles:
 * - "$4.50" / "-$4.50"
 * - "($4.50)" (parentheses = negative)
 * - "4.50" / "-4.50"
 * - "1,234.56" (comma as thousands separator)
 * - "1.234,56" (European format with comma as decimal)
 */
function parseAmount(amountStr: string): number | null {
  let s = amountStr.trim();
  if (!s) return null;

  let isNegative = false;

  // Check for parentheses (accounting convention for negatives)
  if (s.startsWith('(') && s.endsWith(')')) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  }

  // Remove currency symbols and whitespace
  s = s.replace(/[$€£¥₿\s]/g, '');

  // Handle explicit sign
  if (s.startsWith('-')) {
    isNegative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  // Detect format: if both comma and dot present, the last one is the decimal separator
  if (s.includes(',') && s.includes('.')) {
    // If comma comes after the last dot, it's European format (1.234,56)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // European: remove dots (thousands), replace comma with dot
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: remove commas (thousands)
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    // Only comma — could be thousands separator or decimal
    // Heuristic: if there's exactly one comma and 1-2 digits after it, it's a decimal
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal comma (European)
      s = parts.join('.');
    } else {
      // Likely thousands separator
      s = s.replace(/,/g, '');
    }
  }

  const num = parseFloat(s);
  if (isNaN(num) || num === 0) return null;

  return isNegative ? -Math.abs(num) : num;
}

/**
 * Main CSV parsing function.
 * @param text Raw CSV file content
 * @param unit Whether amounts in the CSV are in USD or sats
 * @param usdPerBtc Current BTC price in USD (for USD→sats conversion)
 * @returns Parse result with transactions and metadata
 */
export function parseCSVTransactions(
  text: string,
  unit: 'usd' | 'sats',
  usdPerBtc?: number
): CSVParseResult {
  const result: CSVParseResult = {
    transactions: [],
    totalRows: 0,
    skippedRows: 0,
    errors: [],
    detectedColumns: {},
  };

  // Normalize line endings and split into lines
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length === 0) {
    result.errors.push('CSV file is empty');
    return result;
  }

  // Detect delimiter (comma, semicolon, or tab)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  } else if (firstLine.includes('\t')) {
    delimiter = '\t';
  }

  // Parse all lines with the detected delimiter
  const parseLine = (line: string): string[] => {
    if (delimiter === ',') return parseCSVLine(line);
    return line.split(delimiter).map(s => s.trim().replace(/^"|"$/g, ''));
  };

  // Detect header row
  const firstRow = parseLine(firstLine);
  const firstRowNormalized = firstRow.map(normalizeHeader);
  const hasHeader =
    firstRowNormalized.some(h => h.includes('date')) ||
    firstRowNormalized.some(h => h.includes('amount') || h.includes('amt')) ||
    firstRowNormalized.some(h => h.includes('description') || h.includes('desc') || h.includes('memo'));

  let headers: string[];
  let dataStartIdx: number;

  if (hasHeader) {
    headers = firstRow;
    result.detectedColumns = {};
    dataStartIdx = 1;
  } else {
    // No header — use positional defaults
    headers = firstRow.map((_, i) => `Column ${i + 1}`);
    dataStartIdx = 0;
  }

  // Detect column indices
  const { dateIdx, descriptionIdx, amountIdx, dateHeader, descriptionHeader, amountHeader } =
    detectColumns(headers);

  result.detectedColumns = {
    date: dateHeader,
    description: descriptionHeader,
    amount: amountHeader,
  };

  // Process data rows
  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    result.totalRows++;

    try {
      const parts = parseLine(line);

      if (parts.length < 3) {
        result.skippedRows++;
        result.errors.push(`Row ${i + 1}: Not enough columns (${parts.length} found, need at least 3)`);
        continue;
      }

      const dateStr = parts[dateIdx] || '';
      const description = parts[descriptionIdx] || '';
      const amountStr = parts[amountIdx] || '';

      // Parse date
      const parsedDate = parseDate(dateStr);
      if (!parsedDate) {
        result.skippedRows++;
        result.errors.push(`Row ${i + 1}: Could not parse date "${dateStr}"`);
        continue;
      }

      // Parse amount
      const rawAmount = parseAmount(amountStr);
      if (rawAmount === null) {
        result.skippedRows++;
        result.errors.push(`Row ${i + 1}: Could not parse amount "${amountStr}"`);
        continue;
      }

      // Determine if income or expense
      const isIncome = rawAmount > 0;
      const absAmount = Math.abs(rawAmount);

      // Convert to sats
      let amountInSats: number;
      if (unit === 'usd') {
        if (!usdPerBtc) {
          result.skippedRows++;
          result.errors.push(`Row ${i + 1}: BTC price not available for USD conversion`);
          continue;
        }
        amountInSats = Math.round((absAmount / usdPerBtc) * 100_000_000);
      } else {
        amountInSats = Math.round(absAmount);
      }

      if (amountInSats <= 0) {
        result.skippedRows++;
        continue;
      }

      result.transactions.push({
        date: parsedDate,
        description: description.trim() || 'Imported transaction',
        amount: amountInSats,
        isIncome,
        rawAmount,
      });
    } catch {
      result.skippedRows++;
      result.errors.push(`Row ${i + 1}: Unexpected parse error`);
    }
  }

  return result;
}
