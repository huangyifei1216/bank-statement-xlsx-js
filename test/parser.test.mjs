import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBankCsv, parseMoney, parseOfx, sanitizeSpreadsheetText } from '../src/index.js';

test('parses Chase CSV with Description prioritized over Details column', () => {
  const chase = `Details,Posting Date,Description,Amount,Type,Balance
DEBIT,01/04/2026,"AWS CLOUD",-128.40,ACH_DEBIT,4081.60
CREDIT,01/08/2026,"STRIPE PAYOUT",2450.00,ACH_CREDIT,6531.60`;
  const rows = parseBankCsv(chase);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, 'AWS CLOUD');
  assert.equal(rows[0].amount, -128.4);
  assert.equal(rows[1].credit, 2450);
});

test('skips Bank of America summary preamble lines automatically', () => {
  const bofa = `Description,,Summary Amt.
Beginning balance as of 01/01/2026,,"4,210.00"

Date,Description,Amount,Running Bal.
01/01/2026,Beginning balance as of 01/01/2026,,"4,210.00"
01/04/2026,"OFFICE DEPOT","-64.85","4,145.15"`;
  const rows = parseBankCsv(bofa);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'OFFICE DEPOT');
  assert.equal(rows[0].debit, 64.85);
});

test('auto-maps Wells Fargo headerless 5-column CSV', () => {
  const wf = `"01/04/2026","-128.40","*","","AWS CLOUD SERVICES"
"01/08/2026","1850.00","*","","CLIENT WIRE"`;
  const rows = parseBankCsv(wf);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].description, 'AWS CLOUD SERVICES');
  assert.equal(rows[1].amount, 1850);
});

test('flips Amex positive purchase charges when invertSigns is enabled', () => {
  const amex = `Date,Description,Amount
01/04/2026,DELTA AIR LINES,412.60
01/19/2026,AUTOPAY PAYMENT,-412.60`;
  const rows = parseBankCsv(amex, { invertSigns: true });
  assert.equal(rows[0].amount, -412.6);
  assert.equal(rows[0].debit, 412.6);
  assert.equal(rows[1].amount, 412.6);
  assert.equal(rows[1].credit, 412.6);
});

test('parses OFX/QFX/QBO blocks and neutralizes Excel formula injection', () => {
  const ofx = `<STMTTRN><DTPOSTED>20260115120000<TRNAMT>-42.50<NAME>=HYPERLINK("evil")</STMTTRN>`;
  const rows = parseOfx(ofx);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, '2026-01-15');
  assert.equal(rows[0].description, "'=HYPERLINK(\"evil\")");
  assert.equal(parseMoney('($1,250.00)'), -1250);
  assert.equal(sanitizeSpreadsheetText('+SUM(A1:A9)'), "'+SUM(A1:A9)");
});
