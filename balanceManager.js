const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sqlDb = require('./sqlDb');
const SpreadsheetReader = require('./spreadsheetReader');

class BalanceManager {
  constructor() {
    this.osApproDir = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';
  }

  /**
   * Parse numeric values from various SAP balance representations
   * Supports: 12345.67, ' 36 265 462.34 ', ' (112 461 223.05)', ' - ', '12.345,67'
   */
  parseAmount(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;

    let s = String(val).trim();
    if (!s || s === '-' || s === '.-' || s === '-   ') return 0;

    let isNegative = false;
    if (s.startsWith('(') && s.endsWith(')')) {
      isNegative = true;
      s = s.substring(1, s.length - 1);
    } else if (s.endsWith('-')) {
      isNegative = true;
      s = s.substring(0, s.length - 1);
    } else if (s.startsWith('-')) {
      isNegative = true;
      s = s.substring(1);
    }

    // Remove all whitespace (including non-breaking spaces \u00a0)
    s = s.replace(/[\s\u00a0\u202f]/g, '');

    // Handle European comma decimal (e.g., "12345,67")
    if (s.includes(',') && !s.includes('.')) {
      s = s.replace(',', '.');
    } else if (s.includes(',') && s.includes('.')) {
      // e.g., "12.345,67" or "12,345.67"
      if (s.indexOf('.') < s.indexOf(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }

    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    const finalVal = isNegative ? -n : n;
    return Math.round(finalVal * 100) / 100;
  }

  /**
   * Detect period key from file content or file path
   * Prioritizes SAP RFSSLD00 header rows (e.g. "Périodes reporting 04-04 2025" -> "042025")
   * and filename patterns (e.g. "balance 04.2025.xls" -> "042025").
   */
  detectPeriodKey(filePath, fileRows = []) {
    const base = path.basename(filePath).toLowerCase();

    // 1. Inspect first 12 rows for SAP RFSSLD00 period strings
    for (let i = 0; i < Math.min(12, fileRows.length); i++) {
      const line = Array.isArray(fileRows[i]) ? fileRows[i].join(' ') : String(fileRows[i] || '');

      // Matches "Périodes reporting 04-04 2025" or "Périodes reporting 12-16 2025"
      const pMatch = line.match(/P[ée]riodes reporting\s*(\d{1,2})\s*-\s*(\d{1,2})\s+(\d{4})/i);
      if (pMatch) {
        const startMonth = String(pMatch[1]).padStart(2, '0');
        const year = pMatch[3];
        return `${startMonth}${year}`; // e.g. "042025", "102026", "122025"
      }
    }

    // 2. Check filename with explicit month and year (e.g. "balance 04.2025.xls", "balance 01-2025.xls")
    const mDot = base.match(/balance\s*(\d{1,2})[\.\-_](\d{4})/i);
    if (mDot) {
      const month = String(mDot[1]).padStart(2, '0');
      const year = mDot[2];
      return `${month}${year}`;
    }

    // 3. Check 6-digit period key in filename (e.g. "balance 102026.xls")
    const mSix = base.match(/(\d{2})(\d{4})/);
    if (mSix) {
      return `${mSix[1]}${mSix[2]}`;
    }

    // 4. Check year-only pattern in filename (e.g. "balance 25.xls" -> "2025")
    const mYr = base.match(/balance\s*(\d{2,4})/);
    if (mYr) {
      const yr = mYr[1];
      return yr.length === 2 ? `20${yr}` : yr;
    }

    // 5. Check any year in header rows as fallback
    for (let i = 0; i < Math.min(10, fileRows.length); i++) {
      const line = Array.isArray(fileRows[i]) ? fileRows[i].join(' ') : String(fileRows[i] || '');
      const yMatch = line.match(/\b(202\d)\b/);
      if (yMatch) return yMatch[1];
    }

    return 'CURRENT';
  }

  /**
   * Parse any SAP Balance file (RFSSLD00 or tabular)
   */
  async parseBalanceFile(filePath, periodOverride = null) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable : ${filePath}`);
    }

    const rawRows = await SpreadsheetReader.readSpreadsheetAsArrays(filePath);

    if (!rawRows || rawRows.length === 0) {
      throw new Error('Le fichier est vide.');
    }

    const detectedPeriod = periodOverride || this.detectPeriodKey(filePath, rawRows);

    // Find header row
    let headerRowIdx = -1;
    let colMap = {
      account: -1,
      desc: -1,
      report: -1,
      debit: -1,
      credit: -1,
      solde: -1
    };

    for (let r = 0; r < Math.min(15, rawRows.length); r++) {
      const row = rawRows[r];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      const strRow = Array.from({ length: row.length }, (_, i) => String(row[i] || '').toLowerCase().trim());

      const acctIdx = strRow.findIndex(c => c && (c.includes('cpte gén') || c === 'compte' || c.includes('account')));
      const descIdx = strRow.findIndex(c => c && (c.includes('désignation') || c.includes('designation') || c.includes('libellé') || c.includes('intitulé')));
      const soldeIdx = strRow.findIndex(c => c && (c.includes('solde cum') || c === 'solde' || c.includes('balance')));

      if (acctIdx !== -1 && (descIdx !== -1 || soldeIdx !== -1)) {
        headerRowIdx = r;
        colMap.account = acctIdx;
        colMap.desc = descIdx !== -1 ? descIdx : acctIdx + 1;

        // Find financial columns
        for (let c = 0; c < strRow.length; c++) {
          const val = strRow[c] || '';
          if (val.includes('report de solde') || val.includes('report initial') || val.includes('opening')) {
            colMap.report = c;
          } else if (val.includes('débit') || val.includes('debit')) {
            colMap.debit = c;
          } else if (val.includes('créd') || val.includes('credit')) {
            colMap.credit = c;
          } else if (val.includes('solde cum') || val === 'solde') {
            colMap.solde = c;
          }
        }
        break;
      }
    }

    // Fallback if header not detected automatically
    if (headerRowIdx === -1) {
      // Check if format 2: row 0 is header
      headerRowIdx = 0;
      colMap = { account: 0, desc: 1, report: 2, debit: 3, credit: 4, solde: 5 };
    }

    const parsedRecords = [];
    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rawAcct = row[colMap.account];
      if (rawAcct === null || rawAcct === undefined) continue;

      const acctStr = String(rawAcct).trim();
      // Filter out total/subtotal lines or non-account strings
      if (!/^\d{4,12}$/.test(acctStr)) continue;

      const desc = colMap.desc !== -1 && row[colMap.desc] ? String(row[colMap.desc]).trim() : '';
      const report = colMap.report !== -1 ? this.parseAmount(row[colMap.report]) : 0;
      const debit = colMap.debit !== -1 ? this.parseAmount(row[colMap.debit]) : 0;
      const credit = colMap.credit !== -1 ? this.parseAmount(row[colMap.credit]) : 0;
      const solde = colMap.solde !== -1 ? this.parseAmount(row[colMap.solde]) : (report + debit - credit);

      parsedRecords.push({
        period_key: detectedPeriod,
        boal_account: acctStr,
        account_desc: desc,
        report_initial: report,
        debit: debit,
        credit: credit,
        solde: solde,
        source_file: path.basename(filePath)
      });
    }

    return {
      periodKey: detectedPeriod,
      fileName: path.basename(filePath),
      totalRecords: parsedRecords.length,
      records: parsedRecords
    };
  }

  /**
   * Save / Upsert parsed balance records into SQL Server
   */
  async saveBalanceToDb(records, periodKey, sourceFileName) {
    if (!records || records.length === 0) {
      return { success: true, count: 0 };
    }

    // Batch process in chunks of 50 to optimize network / query execution
    const CHUNK_SIZE = 50;
    let totalUpserted = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const valuesClause = chunk.map(r => {
        const safeDesc = (r.account_desc || '').replace(/'/g, "''");
        const safeSource = (sourceFileName || r.source_file || '').replace(/'/g, "''");
        return `SELECT '${periodKey}' AS period_key, '${r.boal_account}' AS boal_account, N'${safeDesc}' AS account_desc, ${r.report_initial} AS report_initial, ${r.debit} AS debit, ${r.credit} AS credit, ${r.solde} AS solde, N'${safeSource}' AS source_file`;
      }).join(' UNION ALL ');

      const mergeSql = `
        MERGE GeneralLedgerBalances AS target
        USING (
          SELECT v.period_key, v.boal_account, c.scf_account, v.account_desc, 
                 v.report_initial, v.debit, v.credit, v.solde, v.source_file
          FROM (${valuesClause}) v
          LEFT JOIN ChartOfAccounts c ON v.boal_account = c.boal_account
        ) AS source
        ON (target.period_key = source.period_key AND target.boal_account = source.boal_account)
        WHEN MATCHED THEN
          UPDATE SET 
            target.scf_account = ISNULL(source.scf_account, target.scf_account),
            target.account_desc = CASE WHEN LEN(source.account_desc) > 0 THEN source.account_desc ELSE target.account_desc END,
            target.report_initial = source.report_initial,
            target.debit = source.debit,
            target.credit = source.credit,
            target.solde = source.solde,
            target.source_file = source.source_file,
            target.updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde, source_file)
          VALUES (source.period_key, source.boal_account, source.scf_account, source.account_desc, source.report_initial, source.debit, source.credit, source.solde, source.source_file);
      `;

      await sqlDb.query(mergeSql);
      totalUpserted += chunk.length;
    }

    return { success: true, count: totalUpserted, periodKey };
  }

  /**
   * 1-Click Import of all balance files from OS-appro folder
   */
  async importFromOSAppro() {
    const results = [];
    if (!fs.existsSync(this.osApproDir)) {
      throw new Error(`Dossier OS-appro introuvable: ${this.osApproDir}`);
    }

    const files = fs.readdirSync(this.osApproDir);
    const balanceFiles = files.filter(f => f.toLowerCase().includes('balance') && (f.endsWith('.xls') || f.endsWith('.xlsx')));

    for (const f of balanceFiles) {
      const fullPath = path.join(this.osApproDir, f);
      try {
        console.log(`[BalanceManager] Importing ${f}...`);
        const parsed = await this.parseBalanceFile(fullPath);
        const saveRes = await this.saveBalanceToDb(parsed.records, parsed.periodKey, f);
        results.push({
          file: f,
          periodKey: parsed.periodKey,
          accountsCount: parsed.totalRecords,
          upserted: saveRes.count,
          success: true
        });
      } catch (err) {
        console.error(`[BalanceManager] Error importing ${f}:`, err.message);
        results.push({
          file: f,
          error: err.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Get Periods Summary and Trial Balance Equality check
   */
  async getPeriodsSummary() {
    const sql = `
      SELECT 
        period_key,
        COUNT(*) AS total_accounts,
        SUM(report_initial) AS total_opening,
        SUM(debit) AS total_debit,
        SUM(credit) AS total_credit,
        SUM(solde) AS total_closing,
        MAX(source_file) AS source_file,
        MAX(updated_at) AS last_updated
      FROM GeneralLedgerBalances
      GROUP BY period_key
      ORDER BY period_key DESC
    `;
    const rows = await sqlDb.query(sql);

    return rows.map(r => {
      const totDeb = Number(r.total_debit) || 0;
      const totCred = Number(r.total_credit) || 0;
      const diffDebCred = Math.abs(totDeb - totCred);
      const isBalanced = diffDebCred < 1.0;

      return {
        period_key: r.period_key,
        total_accounts: r.total_accounts,
        total_opening: Number(r.total_opening) || 0,
        total_debit: totDeb,
        total_credit: totCred,
        total_closing: Number(r.total_closing) || 0,
        diff_debit_credit: diffDebCred,
        is_balanced: isBalanced,
        source_file: r.source_file,
        last_updated: r.last_updated
      };
    });
  }

  /**
   * Get balance rows with optional filtering by class and text search
   */
  async getBalances(periodKey, filterClass = null, search = null) {
    let where = `WHERE period_key = '${periodKey.replace(/'/g, "''")}'`;

    if (filterClass) {
      const cls = String(filterClass).trim();
      where += ` AND (boal_account LIKE '${cls}%' OR scf_account LIKE '${cls}%')`;
    }

    if (search) {
      const s = String(search).trim().replace(/'/g, "''");
      where += ` AND (boal_account LIKE '%${s}%' OR scf_account LIKE '%${s}%' OR account_desc LIKE '%${s}%')`;
    }

    const sql = `
      SELECT 
        id, period_key, boal_account, scf_account, account_desc,
        report_initial, debit, credit, solde, source_file, updated_at
      FROM GeneralLedgerBalances
      ${where}
      ORDER BY boal_account ASC
    `;

    const rows = await sqlDb.query(sql);
    return rows;
  }

  /**
   * Delete all balance lines for a specific period
   */
  async deletePeriod(periodKey) {
    if (!periodKey) throw new Error('periodKey obligatoire');
    const sql = `DELETE FROM GeneralLedgerBalances WHERE period_key = '${periodKey.replace(/'/g, "''")}'`;
    await sqlDb.query(sql);
    return { success: true, periodKey };
  }
}

module.exports = new BalanceManager();
