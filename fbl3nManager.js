const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sqlDb = require('./sqlDb');
const SpreadsheetReader = require('./spreadsheetReader');

class FBL3NManager {
  constructor() {
    this.defaultFilePath = path.join(
      'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro',
      'FBL3N 051026.xlsx'
    );
  }

  parseExcelDate(v) {
    if (!v) return null;
    if (typeof v === 'number') {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    if (v instanceof Date) {
      if (!isNaN(v.getTime())) return v.toISOString().split('T')[0];
    }
    const s = String(v).trim();
    const num = Number(s);
    if (!isNaN(num) && num > 30000 && num < 80000) {
      const d = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    const m1 = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
    const m2 = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
    return null;
  }

  parseAmount(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    let s = String(v).trim().replace(/\s/g, '').replace(/\u00a0/g, '');
    if (s.includes(',') && !s.includes('.')) {
      s = s.replace(',', '.');
    } else if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  parseDate(v) {
    return this.parseExcelDate(v);
  }

  escapeSql(str, maxLen = 0) {
    if (str === null || str === undefined) return 'NULL';
    let s = String(str).replace(/'/g, "''").trim();
    if (maxLen > 0 && s.length > maxLen) s = s.substring(0, maxLen);
    return `N'${s}'`;
  }

  /**
   * Helper to accurately extract fiscal year, month, and date from an FBL3N row
   */
  extractRowPeriod(r) {
    const yearMonth = String(r['Année/mois'] || r['Année/Mois'] || r['Year/Month'] || '').trim();
    const postDate = this.parseExcelDate(r['Date comptable'] || r['Posting Date']);
    const docDate = this.parseExcelDate(r['Date de pièce'] || r['Date pièce'] || r['Document Date']);
    const assignment = String(r['Affectation'] || r['Assignment'] || '').trim();
    const period = parseInt(r['Période comptable'] || r['Période'] || r['Period']) || null;

    let fiscalYear = null;
    let fiscalMonth = null;

    if (yearMonth && yearMonth.includes('/')) {
      const parts = yearMonth.split('/');
      fiscalYear = parseInt(parts[0]) || null;
      fiscalMonth = parseInt(parts[1]) || null;
    } else if (postDate) {
      fiscalYear = parseInt(postDate.substring(0, 4)) || null;
      fiscalMonth = parseInt(postDate.substring(5, 7)) || null;
    } else if (docDate) {
      fiscalYear = parseInt(docDate.substring(0, 4)) || null;
      fiscalMonth = parseInt(docDate.substring(5, 7)) || null;
    } else if (assignment && /^20\d{2}/.test(assignment)) {
      fiscalYear = parseInt(assignment.substring(0, 4)) || null;
      fiscalMonth = parseInt(assignment.substring(4, 6)) || null;
    } else if (period) {
      fiscalMonth = period;
      fiscalYear = 2026;
    }

    if (!fiscalYear) fiscalYear = 2026;
    if (!fiscalMonth && period) fiscalMonth = period;
    if (!fiscalMonth) fiscalMonth = 1;

    const formattedYearMonth = `${fiscalYear}/${String(fiscalMonth).padStart(2, '0')}`;
    return { fiscalYear, fiscalMonth, yearMonth: formattedYearMonth, postDate, docDate, period };
  }

  /**
   * Imports FBL3N line items from an Excel file into SQL Server
   * @param {string|Buffer} source - File path string or file buffer
   * @param {object} options - { importMode: 'month'|'year'|'all', clearExisting: boolean, sourceFileName: string }
   */
  async importFromExcel(source, options = {}) {
    const startTime = Date.now();
    const { headers, rows: rawRows } = await SpreadsheetReader.readSpreadsheet(source, options);

    if (!rawRows || rawRows.length === 0) {
      throw new Error(`Aucune écriture trouvée dans le fichier`);
    }

    console.log(`[FBL3NManager] Read ${rawRows.length} rows from file (headers: ${headers.length}).`);

    // Prepare table if not exists
    await this.ensureTableSchema();

    // Determine fiscal years and periods (year + month) present in this file
    const yearsInFile = new Set();
    const periodsMap = new Map(); // Map<year, Set<month>>
    const periodsList = new Set(); // Set<"YYYY/MM">

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const account = String(r['Compte'] || r['Account'] || '').trim();
      const docNumber = String(r['Nº pièce'] || r['Document Number'] || r['Pièce'] || '').trim();
      if (!account && !docNumber) continue;

      const { fiscalYear, fiscalMonth, yearMonth } = this.extractRowPeriod(r);
      if (fiscalYear) {
        yearsInFile.add(fiscalYear);
        if (!periodsMap.has(fiscalYear)) {
          periodsMap.set(fiscalYear, new Set());
        }
        if (fiscalMonth) {
          periodsMap.get(fiscalYear).add(fiscalMonth);
          periodsList.add(yearMonth);
        }
      }
    }
    if (yearsInFile.size === 0) yearsInFile.add(2026);

    const importMode = options.importMode || (options.clearExisting ? 'all' : 'month');
    console.log(`[FBL3NManager] Import Mode: "${importMode}". Found years: [${Array.from(yearsInFile).join(', ')}], periods: [${Array.from(periodsList).join(', ')}]`);

    // Handle data replacement according to user mode
    if (importMode === 'all' || options.clearExisting === true) {
      console.log('[FBL3NManager] Clearing entire FBL3NLineItems table...');
      await sqlDb.query('TRUNCATE TABLE FBL3NLineItems');
    } else if (importMode === 'year') {
      const yearsArr = Array.from(yearsInFile);
      console.log(`[FBL3NManager] Mode Annuel: Refreshing entire year(s) ${yearsArr.join(', ')}...`);
      await sqlDb.query(`DELETE FROM FBL3NLineItems WHERE fiscal_year IN (${yearsArr.join(',')})`);
    } else {
      // Default: 'month' (Granular incremental by month & year)
      // Only delete records for the specific month(s) of the specific year(s) present in the upload!
      const whereClauses = [];
      for (const [yr, moSet] of periodsMap.entries()) {
        const moArr = Array.from(moSet).filter(m => m !== null && !isNaN(m));
        if (moArr.length > 0) {
          whereClauses.push(`(fiscal_year = ${yr} AND fiscal_month IN (${moArr.join(',')}))`);
        } else {
          whereClauses.push(`(fiscal_year = ${yr})`);
        }
      }
      if (whereClauses.length > 0) {
        const deleteSql = `DELETE FROM FBL3NLineItems WHERE ${whereClauses.join(' OR ')}`;
        console.log(`[FBL3NManager] Mode Mensuel Incrémental: Executing cleanup query: ${deleteSql}`);
        await sqlDb.query(deleteSql);
      }
    }

    let insertedCount = 0;
    const batchSize = 400; // Safe batch size well under SQL Server limits
    let currentBatchValues = [];

    const yearsSet = new Set(yearsInFile);
    const monthsSet = new Set();

    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];

      const account = String(r['Compte'] || r['Account'] || '').trim();
      const docNumber = String(r['Nº pièce'] || r['Document Number'] || r['Pièce'] || '').trim();
      if (!account || !docNumber) continue;

      const ref = String(r['Référence'] || r['Reference'] || '').trim();
      const supplierId = String(r['Fournisseur'] || r['Vendor'] || '').trim();
      const counterparty = String(r['Compte contrepartie'] || r['Offsetting account'] || '').trim();
      const docType = String(r['Type de pièce'] || r['Document Type'] || '').trim();
      const postKey = String(r['Clé comptabilisation'] || '').trim();
      const amtLocal = this.parseAmount(r['Montant en devise interne']);
      const currLocal = String(r['Devise interne'] || 'DZD').trim();
      const amtDoc = this.parseAmount(r['Montant devise document']) || amtLocal;
      const currDoc = String(r['Devise pièce'] || currLocal).trim();
      const taxCode = String(r['Code TVA'] || '').trim();
      const clearingDoc = String(r['Pièce rapprochement'] || '').trim();
      const textDesc = String(r['Texte'] || r['Text'] || '').trim();
      const assignment = String(r['Affectation'] || r['Assignment'] || '').trim();

      const { fiscalYear, fiscalMonth, yearMonth, postDate, docDate, period } = this.extractRowPeriod(r);

      if (fiscalYear) yearsSet.add(fiscalYear);
      if (fiscalMonth) monthsSet.add(fiscalMonth);

      const sqlDocDate = docDate ? `'${docDate}'` : 'NULL';
      const sqlPostDate = postDate ? `'${postDate}'` : 'NULL';
      const sqlPeriod = period !== null && !isNaN(period) ? period : 'NULL';
      const sqlYear = fiscalYear !== null && !isNaN(fiscalYear) ? fiscalYear : 'NULL';
      const sqlMonth = fiscalMonth !== null && !isNaN(fiscalMonth) ? fiscalMonth : 'NULL';

      const rowSql = `(
        ${this.escapeSql(account, 50)},
        ${this.escapeSql(docNumber, 50)},
        ${this.escapeSql(ref, 100)},
        ${this.escapeSql(supplierId, 50)},
        ${this.escapeSql(counterparty, 50)},
        ${this.escapeSql(yearMonth, 20)},
        ${sqlYear},
        ${sqlMonth},
        ${this.escapeSql(docType, 10)},
        ${sqlPostDate},
        ${sqlDocDate},
        ${sqlPeriod},
        ${this.escapeSql(postKey, 10)},
        ${amtLocal},
        ${this.escapeSql(currLocal, 10)},
        ${amtDoc},
        ${this.escapeSql(currDoc, 10)},
        ${this.escapeSql(taxCode, 10)},
        ${this.escapeSql(clearingDoc, 50)},
        ${this.escapeSql(textDesc, 500)},
        ${this.escapeSql(assignment, 100)}
      )`;

      currentBatchValues.push(rowSql);

      if (currentBatchValues.length >= batchSize) {
        await this.flushBatch(currentBatchValues);
        insertedCount += currentBatchValues.length;
        currentBatchValues = [];
        if (insertedCount % 4000 === 0) {
          console.log(`[FBL3NManager] Progress: ${insertedCount} / ${rawRows.length} rows inserted...`);
        }
      }
    }

    if (currentBatchValues.length > 0) {
      await this.flushBatch(currentBatchValues);
      insertedCount += currentBatchValues.length;
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[FBL3NManager] Successfully inserted ${insertedCount} FBL3N line items in ${durationSec}s.`);


    return {
      success: true,
      totalInserted: insertedCount,
      durationSeconds: durationSec,
      years: Array.from(yearsSet).sort(),
      months: Array.from(monthsSet).sort((a, b) => a - b),
      periods: Array.from(periodsList).sort(),
      importMode
    };
  }

  async flushBatch(valuesArr) {
    if (valuesArr.length === 0) return;
    const sql = `
      INSERT INTO FBL3NLineItems (
        account, doc_number, reference, supplier_id, counterparty_account,
        year_month, fiscal_year, fiscal_month, doc_type, posting_date, doc_date,
        posting_period, posting_key, amount_local, currency_local,
        amount_doc, currency_doc, tax_code, clearing_doc, text_desc, assignment
      ) VALUES ${valuesArr.join(',\n')};
    `;
    await sqlDb.query(sql);
  }

  async ensureTableSchema() {
    await sqlDb.query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FBL3NLineItems')
      BEGIN
        CREATE TABLE FBL3NLineItems (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          account VARCHAR(50),
          doc_number VARCHAR(50),
          reference NVARCHAR(100),
          supplier_id VARCHAR(50),
          counterparty_account VARCHAR(50),
          year_month VARCHAR(20),
          fiscal_year INT,
          fiscal_month INT,
          doc_type VARCHAR(10),
          posting_date DATE,
          doc_date DATE,
          posting_period INT,
          posting_key VARCHAR(10),
          amount_local DECIMAL(18, 2),
          currency_local VARCHAR(10) DEFAULT 'DZD',
          amount_doc DECIMAL(18, 2),
          currency_doc VARCHAR(10) DEFAULT 'DZD',
          tax_code VARCHAR(10),
          clearing_doc VARCHAR(50),
          text_desc NVARCHAR(500),
          assignment NVARCHAR(100),
          created_at DATETIME DEFAULT GETDATE()
        );

        CREATE INDEX IX_FBL3N_YearMonth ON FBL3NLineItems(year_month);
        CREATE INDEX IX_FBL3N_Account ON FBL3NLineItems(account);
        CREATE INDEX IX_FBL3N_DocNumber ON FBL3NLineItems(doc_number);
        CREATE INDEX IX_FBL3N_Year ON FBL3NLineItems(fiscal_year);
        CREATE INDEX IX_FBL3N_Month ON FBL3NLineItems(fiscal_month);
      END
    `);
  }

  /**
   * Retrieves line items with flexible filters and pagination
   */
  async getLineItems(filters = {}) {
    let where = ['1=1'];

    if (filters.year && filters.year !== 'ALL') {
      const y = parseInt(filters.year);
      if (!isNaN(y)) where.push(`f.fiscal_year = ${y}`);
    }

    if (filters.month && filters.month !== 'ALL') {
      const m = parseInt(filters.month);
      if (!isNaN(m)) where.push(`f.fiscal_month = ${m}`);
    }

    if (filters.year_month && filters.year_month !== 'ALL') {
      const ym = String(filters.year_month).replace(/'/g, "''");
      where.push(`f.year_month = '${ym}'`);
    }

    if (filters.account && filters.account !== 'ALL') {
      const acc = String(filters.account).replace(/'/g, "''").trim();
      where.push(`(f.account = '${acc}' OR c.scf_account = '${acc}' OR c.scf_account LIKE '${acc}%')`);
    }

    if (filters.doc_type && filters.doc_type !== 'ALL') {
      const dt = String(filters.doc_type).replace(/'/g, "''").trim();
      where.push(`f.doc_type = '${dt}'`);
    }

    if (filters.search) {
      const s = String(filters.search).replace(/'/g, "''").toLowerCase().trim();
      where.push(`(
        LOWER(f.doc_number) LIKE '%${s}%' OR
        LOWER(f.reference) LIKE '%${s}%' OR
        LOWER(f.text_desc) LIKE '%${s}%' OR
        LOWER(f.supplier_id) LIKE '%${s}%' OR
        LOWER(f.counterparty_account) LIKE '%${s}%' OR
        LOWER(f.assignment) LIKE '%${s}%' OR
        LOWER(c.description) LIKE '%${s}%'
      )`);
    }

    const whereClause = where.join(' AND ');

    // 1. Get Summary Totals
    const statsSql = `
      SELECT 
        COUNT(*) AS totalCount,
        ISNULL(SUM(CASE WHEN f.amount_local > 0 THEN f.amount_local ELSE 0 END), 0) AS totalDebit,
        ISNULL(SUM(CASE WHEN f.amount_local < 0 THEN ABS(f.amount_local) ELSE 0 END), 0) AS totalCredit,
        ISNULL(SUM(f.amount_local), 0) AS netBalance
      FROM FBL3NLineItems f
      LEFT JOIN ChartOfAccounts c ON f.account = c.boal_account
      WHERE ${whereClause};
    `;
    const statsRes = await sqlDb.query(statsSql);
    const stats = statsRes[0] || { totalCount: 0, totalDebit: 0, totalCredit: 0, netBalance: 0 };

    // 2. Paginated rows
    const limit = Math.min(Math.max(parseInt(filters.limit) || 100, 1), 500);
    const offset = Math.max(parseInt(filters.offset) || 0, 0);

    const rowsSql = `
      SELECT 
        f.id,
        f.account,
        c.scf_account AS scfAccount,
        ISNULL(c.description, '') AS accountDesc,
        f.doc_number AS docNumber,
        f.reference,
        f.supplier_id AS supplierId,
        f.counterparty_account AS counterpartyAccount,
        f.year_month AS yearMonth,
        f.fiscal_year AS fiscalYear,
        f.fiscal_month AS fiscalMonth,
        f.doc_type AS docType,
        CONVERT(VARCHAR(10), f.posting_date, 120) AS postingDate,
        CONVERT(VARCHAR(10), f.doc_date, 120) AS docDate,
        f.posting_period AS postingPeriod,
        f.posting_key AS postingKey,
        f.amount_local AS amountLocal,
        f.currency_local AS currencyLocal,
        f.amount_doc AS amountDoc,
        f.currency_doc AS currencyDoc,
        f.tax_code AS taxCode,
        f.clearing_doc AS clearingDoc,
        f.text_desc AS textDesc,
        f.assignment
      FROM FBL3NLineItems f
      LEFT JOIN ChartOfAccounts c ON f.account = c.boal_account
      WHERE ${whereClause}
      ORDER BY f.posting_date DESC, f.doc_number DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY;
    `;
    const rows = await sqlDb.query(rowsSql);

    return {
      stats: {
        totalCount: Number(stats.totalCount) || 0,
        totalDebit: Number(stats.totalDebit) || 0,
        totalCredit: Number(stats.totalCredit) || 0,
        netBalance: Number(stats.netBalance) || 0
      },
      pagination: {
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil((Number(stats.totalCount) || 0) / limit)
      },
      rows
    };
  }

  /**
   * Retrieves available filter options (years, months, top accounts)
   */
  async getFilterOptions() {
    const yearsRes = await sqlDb.query(`
      SELECT DISTINCT fiscal_year AS [year]
      FROM FBL3NLineItems
      WHERE fiscal_year IS NOT NULL
      ORDER BY fiscal_year DESC;
    `);

    const monthsRes = await sqlDb.query(`
      SELECT DISTINCT fiscal_year AS [year], fiscal_month AS [month], year_month AS yearMonth, COUNT(*) AS count
      FROM FBL3NLineItems
      WHERE fiscal_year IS NOT NULL AND fiscal_month IS NOT NULL
      GROUP BY fiscal_year, fiscal_month, year_month
      ORDER BY fiscal_year DESC, fiscal_month ASC;
    `);

    const accountsRes = await sqlDb.query(`
      SELECT TOP 200 
        f.account,
        ISNULL(c.scf_account, '') AS scfAccount,
        ISNULL(c.description, '') AS accountDesc,
        COUNT(*) AS entryCount,
        SUM(f.amount_local) AS totalAmount
      FROM FBL3NLineItems f
      LEFT JOIN ChartOfAccounts c ON f.account = c.boal_account
      GROUP BY f.account, c.scf_account, c.description
      ORDER BY entryCount DESC;
    `);

    const docTypesRes = await sqlDb.query(`
      SELECT DISTINCT doc_type AS docType, COUNT(*) as count
      FROM FBL3NLineItems
      WHERE doc_type IS NOT NULL AND doc_type != ''
      GROUP BY doc_type
      ORDER BY count DESC;
    `);

    return {
      years: yearsRes.map(r => r.year),
      periods: monthsRes,
      accounts: accountsRes,
      docTypes: docTypesRes
    };
  }

  /**
   * Returns list of distinct fiscal years in FBL3NLineItems
   */
  async getAvailableYears() {
    const yearsRes = await sqlDb.query(`
      SELECT DISTINCT fiscal_year AS year 
      FROM FBL3NLineItems 
      WHERE fiscal_year IS NOT NULL 
      ORDER BY fiscal_year DESC;
    `);
    const years = yearsRes.map(r => r.year).filter(y => y && y > 2000);
    return years.length > 0 ? years : [2026];
  }

  /**
   * Computes Class 60 / Consommation charges directly from FBL3N for a specific year and optional month
   */
  async getConsommationChargesByYear(year, month = null) {
    const yr = parseInt(year, 10);
    const mo = (month && month !== 'ALL') ? parseInt(month, 10) : null;
    const monthFilter = mo ? `AND f.fiscal_month = ${mo}` : '';
    return await sqlDb.query(`
      SELECT 
        f.account AS boal,
        ISNULL(c.scf_account, '') AS dz,
        ISNULL(c.description, '') AS [desc],
        SUM(CASE WHEN f.amount_local > 0 THEN f.amount_local ELSE 0 END) AS debit,
        SUM(CASE WHEN f.amount_local < 0 THEN ABS(f.amount_local) ELSE 0 END) AS credit,
        SUM(f.amount_local) AS solde
      FROM FBL3NLineItems f
      LEFT JOIN ChartOfAccounts c ON f.account = c.boal_account
      WHERE f.fiscal_year = ${yr} ${monthFilter}
        AND (c.scf_account LIKE '60%' OR f.account LIKE '4000%' OR f.account LIKE '4001%' OR f.account LIKE '4403%' OR f.account LIKE '4404%' OR f.account LIKE '4409%' OR c.description LIKE '%ACHATS CONSOM%')
      GROUP BY f.account, c.scf_account, c.description
      ORDER BY solde DESC;
    `);
  }

  /**
   * Synchronizes vendor invoice line items (KR, RE, KG) from FBL3NLineItems
   * into SupplierInvoices (SQL Server) and storage.invoices (memory / persistence).
   */
  async syncVendorInvoicesFromFBL3N(fiscalYear = null, fiscalMonth = null) {
    try {
      let whereClause = "doc_type IN ('KR', 'RE', 'KG') AND posting_key IN ('31', '21')";
      if (fiscalYear) whereClause += ` AND fiscal_year = ${parseInt(fiscalYear, 10)}`;
      if (fiscalMonth && fiscalMonth !== 'ALL') whereClause += ` AND fiscal_month = ${parseInt(fiscalMonth, 10)}`;

      const headerLines = await sqlDb.query(`
        SELECT 
          doc_number, doc_type, posting_date, doc_date, fiscal_year, fiscal_month,
          supplier_id, text_desc, amount_local, currency_local, reference, assignment,
          posting_key, account
        FROM FBL3NLineItems
        WHERE ${whereClause};
      `);

      if (!headerLines || headerLines.length === 0) {
        return { count: 0, message: 'Aucune facture fournisseur trouvée dans FBL3N pour cette période.' };
      }

      // Fetch detail lines for tax computation (TVA 1787, Debours 17300015, Retenue 1971)
      const docNumbers = Array.from(new Set(headerLines.map(h => `'${h.doc_number}'`))).join(',');
      const detailLines = await sqlDb.query(`
        SELECT doc_number, account, amount_local
        FROM FBL3NLineItems
        WHERE doc_number IN (${docNumbers});
      `);

      const taxMap = new Map();
      detailLines.forEach(d => {
        const doc = d.doc_number;
        if (!taxMap.has(doc)) {
          taxMap.set(doc, { tva: 0, debours: 0, retunie: 0 });
        }
        const item = taxMap.get(doc);
        const acc = String(d.account || '');
        const amt = Number(d.amount_local) || 0;

        if (acc.startsWith('1787')) {
          item.tva += Math.abs(amt);
        } else if (acc === '17300015' && amt > 0) {
          item.debours += amt;
        } else if (acc.startsWith('1971')) {
          item.retunie += Math.abs(amt);
        }
      });

      const storage = require('./storage');
      let syncedCount = 0;

      for (const h of headerLines) {
        const piece = String(h.doc_number || '').trim();
        if (!piece) continue;

        const taxes = taxMap.get(piece) || { tva: 0, debours: 0, retunie: 0 };
        const rawAmt = Math.abs(Number(h.amount_local) || 0);

        let sId = String(h.supplier_id || '').trim();
        let sName = 'FOURNISSEUR INCONNU';
        let category = 'Diver';

        const existingSup = storage.suppliers.get(sId);
        if (existingSup) {
          sName = existingSup.supplierName;
          category = existingSup.category || 'PD';
        } else {
          let txt = String(h.text_desc || '').trim();
          txt = txt.replace(/^(FACTURE|QUITANCE|AVOIR)\s+N[°º\^]?\s*[\w\d\-\/]+\s+/i, '').trim();
          if (txt) {
            sName = txt;
          } else if (sId) {
            sName = `Fournisseur ${sId}`;
          }

          if (/SLR|SANITARY/i.test(sName)) category = 'PD';
          else if (/TRANSIT|DOUANE|SWISSPORT|CMA|TRANS/i.test(sName)) category = 'S';
          else if (/MOBILIS|ALGERIE TELECOM/i.test(sName)) category = 'S';
          else if (/ETIQAL/i.test(sName)) category = 'MA';
          else category = 'PD';
        }

        const debours = taxes.debours;
        const tva = taxes.tva;
        const retunie = taxes.retunie;
        let netHT = rawAmt - debours - tva + retunie;
        if (netHT <= 0) netHT = rawAmt;

        let dt = '';
        if (h.posting_date) {
          try {
            dt = new Date(h.posting_date).toISOString().split('T')[0];
          } catch (e) {
            dt = `${h.fiscal_year}-${String(h.fiscal_month).padStart(2, '0')}-01`;
          }
        } else {
          dt = `${h.fiscal_year}-${String(h.fiscal_month).padStart(2, '0')}-01`;
        }

        const aff = String(h.reference || h.assignment || '').replace(/'/g, "''");
        const docType = String(h.doc_type || 'KR');
        const month = parseInt(h.fiscal_month, 10) || 1;
        const year = parseInt(h.fiscal_year, 10) || 2026;
        const curr = String(h.currency_local || 'DZD');
        const isLoc = (curr === 'DZD' || !curr) ? 1 : 0;
        const safeSName = sName.replace(/'/g, "''");

        await sqlDb.query(`
          MERGE SupplierInvoices AS target
          USING (
            SELECT '${piece}' AS piece, N'${aff}' AS affectation, '${docType}' AS doc_type,
                   '${sId}' AS supplier_id, N'${safeSName}' AS supplier_name, '${dt}' AS date_comptable,
                   ${month} AS month, ${year} AS year, '${curr}' AS currency, ${isLoc} AS is_local,
                   ${rawAmt} AS f41_amount, 0 AS foreign_amount, '${category}' AS category,
                   ${debours} AS debours, ${tva} AS tva, ${retunie} AS retunie, ${netHT} AS net_ht,
                   'ACTIVE' AS status
          ) AS source
          ON (target.piece = source.piece)
          WHEN MATCHED THEN
            UPDATE SET target.affectation = source.affectation, 
                       target.supplier_name = CASE WHEN target.supplier_name IS NULL OR target.supplier_name = 'FOURNISSEUR' THEN source.supplier_name ELSE target.supplier_name END,
                       target.month = source.month, target.year = source.year, target.net_ht = source.net_ht,
                       target.f41_amount = source.f41_amount, target.updated_at = GETDATE()
          WHEN NOT MATCHED THEN
            INSERT (piece, affectation, doc_type, supplier_id, supplier_name, date_comptable,
                    month, year, currency, is_local, f41_amount, foreign_amount, category,
                    debours, tva, retunie, net_ht, status)
            VALUES (source.piece, source.affectation, source.doc_type, source.supplier_id, source.supplier_name, source.date_comptable,
                    source.month, source.year, source.currency, source.is_local, source.f41_amount, source.foreign_amount, source.category,
                    source.debours, source.tva, source.retunie, source.net_ht, source.status);
        `);

        // Also sync in-memory storage
        storage.invoices.set(piece, {
          piece,
          affectation: aff,
          docType,
          supplierId: sId,
          supplierName: sName,
          dateComptable: dt,
          month,
          year,
          currency: curr,
          isLocal: isLoc === 1,
          f41Amount: rawAmt,
          foreignAmount: null,
          category,
          debours,
          tva,
          retunie,
          netHT,
          isDeleted: false,
          status: 'ACTIVE'
        });

        syncedCount++;
      }

      console.log(`[FBL3NManager] Successfully synchronized ${syncedCount} vendor invoices from FBL3N into SupplierInvoices.`);
      return { count: syncedCount, success: true };
    } catch (err) {
      console.error('[FBL3NManager] Error synchronizing vendor invoices:', err);
      return { count: 0, error: err.message, success: false };
    }
  }
}

module.exports = new FBL3NManager();
