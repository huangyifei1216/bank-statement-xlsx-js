# bank-statement-xlsx-js

Zero-dependency JavaScript (ESM) utility for parsing real-world US bank exports (**Chase**, **Bank of America** summary-preamble CSVs, **Wells Fargo** headerless 5-column CSVs, **American Express** inverted charge signs, and **OFX/QFX/QBO** Web Connect files) with spreadsheet formula-injection sanitization.

> Need a free, browser-local tool to convert your bank statements into a real formatted **Excel (`.xlsx`) workbook with `=SUM()` totals** or a clean **QuickBooks Online CSV** with zero cloud uploads? Try **[Ledger Importer](https://ledgerimporter.com/)**:
> - [Bank Statement to Excel (.xlsx) Converter](https://ledgerimporter.com/bank-statement-to-excel)
> - [Bank Statement PDF to Excel & CSV Converter](https://ledgerimporter.com/bank-statement-pdf-to-excel)
> - [Chase Bank Statement to Excel Converter](https://ledgerimporter.com/chase-bank-statement-to-excel)
> - [Bank of America Statement to Excel Converter](https://ledgerimporter.com/bank-of-america-statement-to-excel)
> - [Wells Fargo Statement to Excel Converter](https://ledgerimporter.com/wells-fargo-statement-to-excel)
> - [Amex Statement to Excel Converter (Auto Sign Flip)](https://ledgerimporter.com/amex-statement-to-excel)
> - [Free QuickBooks Online CSV Formatter](https://ledgerimporter.com/csv-to-qbo)

## Real-world bank export quirks handled out of the box

| Bank / Format | Common Breakage in Excel | How `bank-statement-xlsx-js` Handles It |
| :--- | :--- | :--- |
| **Chase CSV** | `Details` column precedes `Description` | Priority header matching picks `Description` over `Details` |
| **Bank of America CSV** | 5–6 summary lines above the real table | Automatically scans past summary preamble to real header row |
| **Wells Fargo CSV** | Completely headerless 5-column CSV with `"*"` column | Detects `date, amount` on row 1 and maps columns automatically |
| **American Express CSV** | Purchases exported as positive `+`, payments as `-` | `invertSigns: true` flips signs cleanly into Debits & Credits |
| **OFX / QFX / QBO** | SGML v1 or XML v2 `<STMTTRN>` blocks | Parses `DTPOSTED`, `TRNAMT`, `NAME`, and `MEMO` cleanly |
| **CSV Formula Injection** | Merchant names starting with `=`, `+`, `-`, `@` | Prefixes leading formula tokens with `'` |

## Usage

```js
import { parseBankCsv, parseOfx } from './src/index.js';

const rows = parseBankCsv(amexCsvText, { invertSigns: true });
const ofxRows = parseOfx(qfxFileText);
```

## Test

```bash
npm test
```

## License

MIT — independent utility; not affiliated with Chase, Bank of America, Wells Fargo, American Express, Microsoft, or Intuit.
