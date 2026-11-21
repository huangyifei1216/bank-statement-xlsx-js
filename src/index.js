/**
 * bank-statement-xlsx-js
 * Zero-dependency bank statement CSV / OFX / QFX parser & spreadsheet sanitizer.
 * Interactive zero-upload Excel (.xlsx) & QuickBooks CSV converter: https://ledgerimporter.com
 */

/**
 * Prevent CSV / Excel formula injection on untrusted bank merchant descriptions.
 * @param {string} value
 */
export function sanitizeSpreadsheetText(value) {
  const cleaned = String(value ?? '')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();
  return /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

/**
 * Parse monetary strings including accounting parentheses, currency signs, trailing minus, DR/CR.
 * @param {string} raw
 * @returns {number|null}
 */
export function parseMoney(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  if (/\bDR\b$/i.test(s)) {
    negative = true;
    s = s.replace(/\bDR\b$/i, '').trim();
  } else if (/\bCR\b$/i.test(s)) {
    s = s.replace(/\bCR\b$/i, '').trim();
  }
  if (s.endsWith('-')) {
    negative = true;
    s = s.slice(0, -1).trim();
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }
  s = s.replace(/[$€£¥,\s]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/**
 * Minimal RFC-4180 CSV line parser handling quoted fields and escaped quotes.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }
  return rows;
}

/**
 * Parse US bank CSV statements including Chase (Details vs Description),
 * Bank of America (summary preamble lines), Wells Fargo (headerless 5-column),
 * and American Express (optional sign inversion).
 * @param {string} csvText
 * @param {{ invertSigns?: boolean }} [options]
 */
export function parseBankCsv(csvText, options = {}) {
  const allRows = parseCsvRows(csvText.replace(/^\uFEFF/, ''));
  if (allRows.length === 0) return [];

  const first = allRows[0];
  let headerRow = first;
  let dataRows = allRows.slice(1);

  // Detect Wells Fargo headerless CSV: "01/04/2026","-128.40","*","","DESCRIPTION"
  if (
    first.length >= 4 &&
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(first[0].trim()) &&
    parseMoney(first[1]) !== null
  ) {
    headerRow = ['Date', 'Amount', 'Marker', 'Check', 'Description'];
    dataRows = allRows;
  } else {
    // Skip Bank of America summary lines until real header row
    const headerIdx = allRows.findIndex((r) => {
      const joined = r.join(' ').toLowerCase();
      return (
        /\bdate\b/.test(joined) &&
        /\b(description|payee|merchant)\b/.test(joined) &&
        /\b(amount|debit|credit)\b/.test(joined)
      );
    });
    if (headerIdx >= 0) {
      headerRow = allRows[headerIdx];
      dataRows = allRows.slice(headerIdx + 1);
    }
  }

  const norm = headerRow.map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  const findCol = (aliases) => {
    for (const a of aliases) {
      const idx = norm.indexOf(a);
      if (idx >= 0) return idx;
    }
    for (const a of aliases) {
      const idx = norm.findIndex((h) => h.includes(a));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateCol = findCol(['posting date', 'posted date', 'transaction date', 'date']);
  const descCol = findCol(['description', 'payee', 'merchant', 'memo', 'details']);
  const amtCol = findCol(['amount', 'transaction amount']);
  const debitCol = findCol(['debit', 'withdrawal']);
  const creditCol = findCol(['credit', 'deposit']);

  if (dateCol < 0 || descCol < 0 || (amtCol < 0 && debitCol < 0 && creditCol < 0)) {
    return [];
  }

  const out = [];
  for (const r of dataRows) {
    const date = (r[dateCol] ?? '').trim();
    const description = sanitizeSpreadsheetText(r[descCol] ?? '');
    let amount = amtCol >= 0 ? parseMoney(r[amtCol]) : null;
    if (amount === null && (debitCol >= 0 || creditCol >= 0)) {
      const d = debitCol >= 0 ? parseMoney(r[debitCol]) : null;
      const c = creditCol >= 0 ? parseMoney(r[creditCol]) : null;
      if (d !== null || c !== null) {
        amount = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0);
      }
    }
    if (!date || amount === null) continue;
    if (options.invertSigns && amount !== 0) amount = -amount;
    out.push({
      date,
      description,
      debit: amount < 0 ? Math.abs(amount) : null,
      credit: amount > 0 ? amount : null,
      amount,
    });
  }
  return out;
}

/**
 * Parse SGML/XML OFX, QFX, or QBO Web Connect transaction blocks.
 * @param {string} ofxText
 */
export function parseOfx(ofxText) {
  const blocks = ofxText.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi) ?? [];
  const tag = (b, name) => {
    const xml = b.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
    if (xml?.[1]) return xml[1].trim();
    const sgml = b.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'));
    return sgml?.[1]?.trim() ?? '';
  };
  const out = [];
  for (const b of blocks) {
    const rawDate = tag(b, 'DTPOSTED');
    const amount = parseMoney(tag(b, 'TRNAMT'));
    const m = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m || amount === null) continue;
    out.push({
      date: `${m[1]}-${m[2]}-${m[3]}`,
      description: sanitizeSpreadsheetText(tag(b, 'NAME') || tag(b, 'MEMO') || 'Bank transaction'),
      debit: amount < 0 ? Math.abs(amount) : null,
      credit: amount > 0 ? amount : null,
      amount,
    });
  }
  return out;
}
