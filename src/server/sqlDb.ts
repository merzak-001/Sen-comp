import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import type { SqlTestResult } from '../types/domain';

const dbServer = process.env.DB_SERVER || process.env.SQL_SERVER_HOST || '192.168.1.253';
const dbName = process.env.DB_NAME || process.env.SQL_SERVER_DATABASE || 'SensusSAPDB';
const dbUser = process.env.DB_USER || 'sa';
const dbPassword = process.env.DB_PASSWORD || '0000';

const dbConfig: sql.config = {
  server: dbServer,
  database: dbName,
  user: dbUser,
  password: dbPassword,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  connectionTimeout: 15000,
  requestTimeout: 60000,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const OS_APPRO_DIR =
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';

export interface InvoiceDbFilters {
  search?: string;
  market?: string;
  category?: string;
  year?: string | number;
  month?: string | number;
}

export interface ObservationInput {
  id: string | number;
  category?: string;
  text?: string;
  isCustom?: boolean;
}

export class SqlDatabase {
  public isConnected = false;
  private pool: sql.ConnectionPool | null = null;
  private poolPromise: Promise<sql.ConnectionPool> | null = null;

  async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) return this.pool;
    if (this.poolPromise) return this.poolPromise;

    this.poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((p) => {
        this.pool = p;
        this.isConnected = true;
        this.poolPromise = null;
        return p;
      })
      .catch((err) => {
        this.pool = null;
        this.poolPromise = null;
        this.isConnected = false;
        throw err;
      });

    return this.poolPromise;
  }

  async query<T = Record<string, any>>(sqlText: string, _params: unknown[] = []): Promise<T[]> {
    const pool = await this.getPool();
    const result = await pool.request().query<T>(sqlText);
    return result.recordset || [];
  }

  async testConnection(): Promise<SqlTestResult> {
    try {
      const res = await this.query<{ db: string; ver: string }>(
        'SELECT DB_NAME() AS db, @@VERSION AS ver'
      );
      this.isConnected = true;
      return { success: true, db: res[0]?.db, version: res[0]?.ver };
    } catch (err) {
      this.isConnected = false;
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  async getDatabaseStats(): Promise<{
    connected: boolean;
    server: string;
    database: string;
    stats: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const counts = await this.query(`
        SELECT 
          (SELECT COUNT(*) FROM ChartOfAccounts) AS chartCount,
          (SELECT COUNT(*) FROM Suppliers) AS suppliersCount,
          (SELECT COUNT(*) FROM GeneralLedgerBalances) AS balancesCount,
          (SELECT COUNT(*) FROM FBL3NLineItems WHERE doc_number <> '') AS glCount
      `);
      return {
        connected: true,
        server: dbServer,
        database: dbName,
        stats: counts[0] || {}
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        server: dbServer,
        database: dbName,
        error: message,
        stats: {}
      };
    }
  }

  /**
   * INCREMENTAL UPSERT / SYNC FROM DOCUMENTS/OS-APPRO
   * Updates existing records, inserts new ones, never drops tables.
   */
  async syncMasterFilesFromOSAppro(): Promise<Record<string, number>> {
    console.log('[SqlDatabase] Starting incremental UPSERT from Documents/OS-appro into SQL Server...');
    const result = {
      chartOfAccounts: 0,
      balances1026: 0,
      balances25: 0,
      invoices: 0,
      debours: 0,
      tva: 0,
      retenue: 0
    };

    // 1. Chart of Accounts (Prioritizes new 'chart accounts.xlsx' from SAP 8660)
    const pathNewChart = path.join(OS_APPRO_DIR, 'chart accounts.xlsx');
    const pathOldChart = path.join(OS_APPRO_DIR, 'chart of accounts.xlsx');
    const targetChartPath = fs.existsSync(pathNewChart) ? pathNewChart : pathOldChart;
    if (fs.existsSync(targetChartPath)) {
      const wb = XLSX.readFile(targetChartPath);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      for (const r of rows) {
        const boal = String(r['Cpte gén.'] || '').trim();
        const dz = String(r['Autre cpte'] || r['Dz'] || '').trim();
        const desc = String(r['Texte descriptif'] || '').trim().replace(/'/g, "''");
        if (boal && /^\d+$/.test(boal)) {
          await this.query(`
            MERGE ChartOfAccounts AS target
            USING (SELECT '${boal}' AS boal_account, '${dz}' AS scf_account, N'${desc}' AS description) AS source
            ON (target.boal_account = source.boal_account)
            WHEN MATCHED THEN
              UPDATE SET target.scf_account = source.scf_account, target.description = source.description, target.updated_at = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (boal_account, scf_account, description) VALUES (source.boal_account, source.scf_account, source.description);
          `);
          result.chartOfAccounts++;
        }
      }
      console.log(
        `[SqlDatabase] Upserted ${result.chartOfAccounts} Chart of Accounts from ${path.basename(targetChartPath)}.`
      );

      // Update GeneralLedgerBalances with the refreshed scf_account
      await this.query(`
        UPDATE gl
        SET gl.scf_account = c.scf_account
        FROM GeneralLedgerBalances gl
        INNER JOIN ChartOfAccounts c ON gl.boal_account = c.boal_account
        WHERE gl.scf_account IS NULL OR gl.scf_account = '' OR gl.scf_account != c.scf_account;
      `);
    }

    // 2. General Ledger Balances 102026
    const pathBal1026 = path.join(OS_APPRO_DIR, 'balance 102026.xls');
    if (fs.existsSync(pathBal1026)) {
      const wb = XLSX.readFile(pathBal1026);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      for (let i = 5; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[3]) continue;
        const boal = String(r[3]).trim();
        const desc = String(r[5] || '').trim().replace(/'/g, "''");
        const report = typeof r[9] === 'number' ? r[9] : 0;
        const debit = typeof r[13] === 'number' ? r[13] : 0;
        const credit = typeof r[15] === 'number' ? r[15] : 0;
        const solde = typeof r[16] === 'number' ? r[16] : 0;
        if (boal && /^\d+$/.test(boal)) {
          await this.query(`
            MERGE GeneralLedgerBalances AS target
            USING (
              SELECT '102026' AS period_key, '${boal}' AS boal_account, 
                     (SELECT TOP 1 scf_account FROM ChartOfAccounts WHERE boal_account = '${boal}') AS scf_account,
                     N'${desc}' AS account_desc, ${report} AS report_initial, ${debit} AS debit, 
                     ${credit} AS credit, ${solde} AS solde, 'balance 102026.xls' AS source_file
            ) AS source
            ON (target.period_key = source.period_key AND target.boal_account = source.boal_account)
            WHEN MATCHED THEN
              UPDATE SET target.report_initial = source.report_initial, target.debit = source.debit,
                         target.credit = source.credit, target.solde = source.solde, target.updated_at = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde, source_file)
              VALUES (source.period_key, source.boal_account, source.scf_account, source.account_desc, source.report_initial, source.debit, source.credit, source.solde, source.source_file);
          `);
          result.balances1026++;
        }
      }
      console.log(`[SqlDatabase] Upserted ${result.balances1026} balances for period 102026.`);
    }

    // 3. General Ledger Balances 2025
    const pathBal25 = path.join(OS_APPRO_DIR, 'balance 25.xls');
    if (fs.existsSync(pathBal25)) {
      const wb = XLSX.readFile(pathBal25);
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const boal = String(r[0]).trim();
        const desc = String(r[1] || '').trim().replace(/'/g, "''");
        const soldeStr = String(r[5] || '').trim().replace(/\s/g, '').replace('(', '-').replace(')', '');
        const solde = parseFloat(soldeStr) || 0;
        if (boal && /^\d+$/.test(boal)) {
          await this.query(`
            MERGE GeneralLedgerBalances AS target
            USING (
              SELECT '2025' AS period_key, '${boal}' AS boal_account, 
                     (SELECT TOP 1 scf_account FROM ChartOfAccounts WHERE boal_account = '${boal}') AS scf_account,
                     N'${desc}' AS account_desc, 0 AS report_initial, 0 AS debit, 
                     0 AS credit, ${solde} AS solde, 'balance 25.xls' AS source_file
            ) AS source
            ON (target.period_key = source.period_key AND target.boal_account = source.boal_account)
            WHEN MATCHED THEN
              UPDATE SET target.solde = source.solde, target.updated_at = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (period_key, boal_account, scf_account, account_desc, report_initial, debit, credit, solde, source_file)
              VALUES (source.period_key, source.boal_account, source.scf_account, source.account_desc, source.report_initial, source.debit, source.credit, source.solde, source.source_file);
          `);
          result.balances25++;
        }
      }
      console.log(`[SqlDatabase] Upserted ${result.balances25} balances for period 2025.`);
    }

    // 4. Transit Debours (debours.xlsx)
    const pathDebours = path.join(OS_APPRO_DIR, 'debours.xlsx');
    if (fs.existsSync(pathDebours)) {
      const wb = XLSX.readFile(pathDebours);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      for (const r of rows) {
        const piece = String(r['Nº pièce'] || '').trim();
        const amt = Math.abs(Number(r['Montant en devise interne'] || r['Montant en dev.rep.'] || 0));
        const sName = String(r['Texte'] || r['Compte contrepartie'] || 'TRANSIT / DOUANE')
          .trim()
          .replace(/'/g, "''");
        const ref = String(r['Référence'] || r['Affectation'] || '').trim().replace(/'/g, "''");
        if (piece && amt > 0) {
          await this.query(`
            INSERT INTO TransitDebours (piece, supplier_name, amount, reference)
            VALUES ('${piece}', N'${sName}', ${amt}, N'${ref}');
          `);
          result.debours++;
        }
      }
      console.log(`[SqlDatabase] Inserted ${result.debours} debours records.`);
    }

    // 5. Fiscal TVA (tva 05102026.xlsx)
    const pathTva = path.join(OS_APPRO_DIR, 'tva 05102026.xlsx');
    if (fs.existsSync(pathTva)) {
      const wb = XLSX.readFile(pathTva);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      for (const r of rows) {
        const piece = String(r['Nº pièce'] || '').trim();
        const amt = Math.abs(Number(r['Montant en devise interne'] || 0));
        const dt = String(r['Date comptable'] || '').trim();
        if (piece && amt > 0) {
          await this.query(`
            INSERT INTO FiscalTVA (piece, amount, date_comptable)
            VALUES ('${piece}', ${amt}, '${dt}');
          `);
          result.tva++;
        }
      }
      console.log(`[SqlDatabase] Inserted ${result.tva} TVA records.`);
    }

    // 6. Fiscal Retenue (retunie.xlsx)
    const pathRetunie = path.join(OS_APPRO_DIR, 'retunie.xlsx');
    if (fs.existsSync(pathRetunie)) {
      const wb = XLSX.readFile(pathRetunie);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
      for (const r of rows) {
        const piece = String(r['Nº pièce'] || '').trim();
        const amt = Math.abs(Number(r['Montant en devise interne'] || 0));
        const txt = String(r['Texte'] || '').trim().replace(/'/g, "''");
        if (piece && amt > 0) {
          await this.query(`
            INSERT INTO FiscalRetenue (piece, supplier_name, amount)
            VALUES ('${piece}', N'${txt}', ${amt});
          `);
          result.retenue++;
        }
      }
      console.log(`[SqlDatabase] Inserted ${result.retenue} Retenue records.`);
    }

    // 7. Supplier Invoices (From reconciled store)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storage = require('./storage').default || require('./storage');
    const invoices = Array.from((storage.invoices as Map<string, Record<string, any>>).values());
    for (const inv of invoices) {
      const piece = String(inv.piece || '').trim();
      if (!piece) continue;

      const aff = String(inv.affectation || '').replace(/'/g, "''");
      const docType = String(inv.docType || 'KR');
      const sId = String(inv.supplierId || '');
      const sName = String(inv.supplierName || 'FOURNISSEUR').replace(/'/g, "''");
      const dt = String(inv.dateComptable || '');
      const month = inv.month || 8;
      const year = inv.year || 2026;
      const curr = String(inv.currency || 'DZD');
      const isLoc = inv.isLocal ? 1 : 0;
      const f41Amt = Number(inv.f41Amount || 0);
      const forAmt = Number(inv.foreignAmount || 0);
      const cat = String(inv.category || 'PD');
      const deb = Number(inv.debours || 0);
      const tva = Number(inv.tva || 0);
      const ret = Number(inv.retunie || 0);
      const net = Number(inv.netHT || f41Amt);
      const status = inv.isDeleted ? 'DELETED' : 'ACTIVE';

      await this.query(`
        MERGE SupplierInvoices AS target
        USING (
          SELECT '${piece}' AS piece, N'${aff}' AS affectation, '${docType}' AS doc_type,
                 '${sId}' AS supplier_id, N'${sName}' AS supplier_name, '${dt}' AS date_comptable,
                 ${month} AS month, ${year} AS year, '${curr}' AS currency, ${isLoc} AS is_local,
                 ${f41Amt} AS f41_amount, ${forAmt} AS foreign_amount, '${cat}' AS category,
                 ${deb} AS debours, ${tva} AS tva, ${ret} AS retunie, ${net} AS net_ht,
                 '${status}' AS status
        ) AS source
        ON (target.piece = source.piece)
        WHEN MATCHED THEN
          UPDATE SET target.affectation = source.affectation, target.supplier_name = source.supplier_name,
                     target.f41_amount = source.f41_amount, target.debours = source.debours, target.tva = source.tva,
                     target.retunie = source.retunie, target.net_ht = source.net_ht, target.category = source.category,
                     target.status = source.status, target.updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (piece, affectation, doc_type, supplier_id, supplier_name, date_comptable, month, year, currency, is_local, f41_amount, foreign_amount, category, debours, tva, retunie, net_ht, status)
          VALUES (source.piece, source.affectation, source.doc_type, source.supplier_id, source.supplier_name, source.date_comptable, source.month, source.year, source.currency, source.is_local, source.f41_amount, source.foreign_amount, source.category, source.debours, source.tva, source.retunie, source.net_ht, source.status);
      `);
      result.invoices++;
    }
    console.log(`[SqlDatabase] Upserted ${result.invoices} Supplier Invoices into SQL Server.`);

    return result;
  }

  // Fetch Invoices directly from SQL Server
  async getInvoicesFromDb(filters: InvoiceDbFilters = {}): Promise<Record<string, any>[]> {
    const whereClauses = ["status = 'ACTIVE'"];
    if (filters.search) {
      const s = filters.search.replace(/'/g, "''").toLowerCase();
      whereClauses.push(
        `(LOWER(piece) LIKE '%${s}%' OR LOWER(supplier_name) LIKE '%${s}%' OR LOWER(affectation) LIKE '%${s}%')`
      );
    }
    if (filters.market === 'LOCAL') whereClauses.push('is_local = 1');
    if (filters.market === 'ETRANGER') whereClauses.push('is_local = 0');
    if (filters.category && filters.category !== 'ALL') {
      whereClauses.push(`category = '${filters.category.replace(/'/g, "''")}'`);
    }
    if (filters.year) {
      whereClauses.push(`year = ${parseInt(String(filters.year), 10)}`);
    }
    if (filters.month && filters.month !== 'ALL') {
      whereClauses.push(`month = ${parseInt(String(filters.month), 10)}`);
    }

    const sqlText = `
      SELECT piece, affectation, doc_type AS docType, supplier_id AS supplierId,
             supplier_name AS supplierName, date_comptable AS dateComptable, month, year,
             currency, is_local AS isLocal, f41_amount AS f41Amount, foreign_amount AS foreignAmount,
             category, debours, tva, retunie, net_ht AS netHT, status
      FROM SupplierInvoices
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY net_ht DESC;
    `;
    return await this.query(sqlText);
  }

  // Fetch GL Balances from SQL Server
  async getGLBalancesFromDb(
    periodKey = '102026',
    filterType = 'all'
  ): Promise<Record<string, any>[]> {
    const whereClauses = [`period_key = '${periodKey}'`];

    if (filterType === 'charges') {
      whereClauses.push(
        "(scf_account LIKE '60%' OR boal_account LIKE '4000%' OR boal_account LIKE '4001%' OR boal_account LIKE '4403%' OR boal_account LIKE '4404%' OR boal_account LIKE '4409%' OR account_desc LIKE '%ACHATS CONSOM%')"
      );
    } else if (filterType === 'stocks') {
      whereClauses.push(
        "(scf_account LIKE '3%' OR boal_account LIKE '3000%' OR boal_account LIKE '7800%' OR boal_account LIKE '7900%' OR account_desc LIKE '%STOCK%' OR account_desc LIKE '%MATIERE%')"
      );
    }

    const sqlText = `
      SELECT boal_account AS boal, scf_account AS dz, account_desc AS [desc],
             report_initial AS report, debit, credit, solde, source_file AS sourceFile
      FROM GeneralLedgerBalances
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY boal_account ASC;
    `;
    return await this.query(sqlText);
  }

  // Fetch Transit & Douane summary directly from SQL Server
  async getTransitSummaryFromDb(
    year: string | number | null = null,
    month: string | number | null = null
  ): Promise<{
    totals: Record<string, any>;
    deboursBySupplier: Record<string, any>[];
  }> {
    let whereClause = "status = 'ACTIVE'";
    if (year) {
      whereClause += ` AND year = ${parseInt(String(year), 10)}`;
    }
    if (month && month !== 'ALL') {
      whereClause += ` AND month = ${parseInt(String(month), 10)}`;
    }
    const totals = await this.query(`
      SELECT 
        ISNULL(SUM(debours), 0) AS totalDebours,
        ISNULL(SUM(tva), 0) AS totalTva,
        ISNULL(SUM(retunie), 0) AS totalRetenue
      FROM SupplierInvoices
      WHERE ${whereClause};
    `);

    const brokers = await this.query(`
      SELECT supplier_name AS supplier, SUM(debours) AS amount
      FROM SupplierInvoices
      WHERE ${whereClause} AND debours > 0
      GROUP BY supplier_name
      ORDER BY amount DESC;
    `);

    return {
      totals: totals[0] || { totalDebours: 0, totalTva: 0, totalRetenue: 0 },
      deboursBySupplier: brokers
    };
  }

  // Save / Upsert report observation into SQL Server
  async saveObservationToDb(periodKey: string, obs: ObservationInput): Promise<void> {
    const pKey = String(periodKey).replace(/'/g, "''");
    const oId = String(obs.id).replace(/'/g, "''");
    const cat = String(obs.category || 'Gestion').replace(/'/g, "''");
    const txt = String(obs.text || '').replace(/'/g, "''");
    const isCust = obs.isCustom ? 1 : 0;

    await this.query(`
      MERGE ReportObservations AS target
      USING (SELECT '${pKey}' AS period_key, '${oId}' AS obs_id, N'${cat}' AS category, N'${txt}' AS text, ${isCust} AS is_custom) AS source
      ON (target.period_key = source.period_key AND target.obs_id = source.obs_id)
      WHEN MATCHED THEN
        UPDATE SET target.category = source.category, target.text = source.text, target.updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (period_key, obs_id, category, text, is_custom)
        VALUES (source.period_key, source.obs_id, source.category, source.text, source.is_custom);
    `);
  }

  // Delete observation from SQL Server
  async deleteObservationFromDb(periodKey: string, obsId: string | number): Promise<void> {
    const pKey = String(periodKey).replace(/'/g, "''");
    const oId = String(obsId).replace(/'/g, "''");
    await this.query(
      `DELETE FROM ReportObservations WHERE period_key = '${pKey}' AND obs_id = '${oId}'`
    );
  }

  // Load observations from SQL Server
  async getObservationsFromDb(periodKey: string): Promise<Record<string, any>[]> {
    const pKey = String(periodKey).replace(/'/g, "''");
    return await this.query(
      `SELECT obs_id AS id, category, text, is_custom AS isCustom FROM ReportObservations WHERE period_key = '${pKey}' ORDER BY id ASC`
    );
  }

  // Update Invoice Category in SQL Server
  async updateInvoiceCategoryInDb(piece: string, category: string): Promise<void> {
    const p = String(piece).replace(/'/g, "''");
    const c = String(category).replace(/'/g, "''");
    await this.query(
      `UPDATE SupplierInvoices SET category = '${c}', updated_at = GETDATE() WHERE piece = '${p}'`
    );
  }

  // Delete Invoice (soft-delete) in SQL Server
  async deleteInvoiceInDb(piece: string): Promise<void> {
    const p = String(piece).replace(/'/g, "''");
    await this.query(
      `UPDATE SupplierInvoices SET status = 'DELETED', updated_at = GETDATE() WHERE piece = '${p}'`
    );
  }

  // Restore Invoice in SQL Server
  async restoreInvoiceInDb(piece: string): Promise<void> {
    const p = String(piece).replace(/'/g, "''");
    await this.query(
      `UPDATE SupplierInvoices SET status = 'ACTIVE', updated_at = GETDATE() WHERE piece = '${p}'`
    );
  }
}

const sqlDb = new SqlDatabase();
export default sqlDb;
