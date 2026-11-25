import fs from 'fs';
import path from 'path';
import sqlDb from './sqlDb';
import fbl3nManager, { type FBL3NImportOptions } from './fbl3nManager';
import balanceManager from './balanceManager';
import SpreadsheetReader from './spreadsheetReader';
import type { DiffLogRecord } from '../types/domain';

export class ReconciliationManager {
  public diffHistory: DiffLogRecord[] = [];

  logDiff(entry: Record<string, unknown>): DiffLogRecord {
    const record: DiffLogRecord = {
      id: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.diffHistory.unshift(record);
    if (this.diffHistory.length > 50) {
      this.diffHistory.pop();
    }
    return record;
  }

  getHistory(): DiffLogRecord[] {
    return this.diffHistory;
  }

  clearHistory(): void {
    this.diffHistory = [];
  }

  async reconcile(
    year: number | string = 2026,
    month: number | string = 10,
    periodKey: string | null = null
  ): Promise<Record<string, unknown>> {
    const yearNum = parseInt(String(year), 10) || 2026;
    let monthNum: number | null = null;
    if (month && month !== 'ALL') {
      monthNum = parseInt(String(month), 10);
    }

    let targetPeriod = periodKey;
    if (!targetPeriod) {
      if (monthNum !== null && !isNaN(monthNum)) {
        const mm = String(monthNum).padStart(2, '0');
        targetPeriod = `${mm}${yearNum}`;
      } else {
        targetPeriod = String(yearNum);
      }
    }

    const checkBalPeriod = await sqlDb.query(
      `SELECT DISTINCT period_key FROM GeneralLedgerBalances WHERE period_key = '${targetPeriod.replace(/'/g, "''")}' OR period_key LIKE '%${yearNum}'`
    );
    const existingKeys = checkBalPeriod.map((r) => String(r.period_key));
    if (!existingKeys.includes(targetPeriod)) {
      if (existingKeys.includes(`10${yearNum}`)) targetPeriod = `10${yearNum}`;
      else if (existingKeys.includes(String(yearNum))) targetPeriod = String(yearNum);
      else if (existingKeys.length > 0) targetPeriod = existingKeys[0];
    }

    const balRows = await sqlDb.query(`
      SELECT 
        b.boal_account,
        ISNULL(b.scf_account, c.scf_account) AS scf_account,
        ISNULL(b.account_desc, c.description) AS account_desc,
        ISNULL(b.report_initial, 0) AS report_initial,
        ISNULL(b.debit, 0) AS bal_debit,
        ISNULL(b.credit, 0) AS bal_credit,
        ISNULL(b.solde, 0) AS bal_solde
      FROM GeneralLedgerBalances b
      LEFT JOIN ChartOfAccounts c ON b.boal_account = c.boal_account
      WHERE b.period_key = '${targetPeriod.replace(/'/g, "''")}'
    `);

    let glWhere = `fiscal_year = ${yearNum} AND doc_number IS NOT NULL AND LEN(LTRIM(RTRIM(doc_number))) > 0`;
    if (monthNum !== null && !isNaN(monthNum)) {
      glWhere += ` AND fiscal_month <= ${monthNum}`;
    }

    const glRows = await sqlDb.query(`
      SELECT 
        f.account AS boal_account,
        COUNT(*) AS gl_count,
        SUM(CASE WHEN f.amount_local > 0 THEN f.amount_local ELSE 0 END) AS gl_debit,
        SUM(CASE WHEN f.amount_local < 0 THEN ABS(f.amount_local) ELSE 0 END) AS gl_credit,
        SUM(f.amount_local) AS gl_net
      FROM FBL3NLineItems f
      WHERE ${glWhere}
      GROUP BY f.account
    `);

    const compMap = new Map<string, Record<string, any>>();

    balRows.forEach((b) => {
      const boal = String(b.boal_account || '').trim();
      if (!boal) return;
      const balMvt =
        Math.round((Number(b.bal_debit || 0) - Number(b.bal_credit || 0)) * 100) / 100;
      compMap.set(boal, {
        boal,
        scf: b.scf_account || '',
        desc: b.account_desc || '',
        reportInitial: Number(b.report_initial || 0),
        balDebit: Number(b.bal_debit || 0),
        balCredit: Number(b.bal_credit || 0),
        balSolde: Number(b.bal_solde || 0),
        balNetMvt: balMvt,
        glCount: 0,
        glDebit: 0,
        glCredit: 0,
        glNet: 0,
        inBalance: true,
        inGL: false
      });
    });

    glRows.forEach((g) => {
      const boal = String(g.boal_account || '').trim();
      if (!boal) return;
      let item = compMap.get(boal);
      if (!item) {
        item = {
          boal,
          scf: '',
          desc: '',
          reportInitial: 0,
          balDebit: 0,
          balCredit: 0,
          balSolde: 0,
          balNetMvt: 0,
          glCount: 0,
          glDebit: 0,
          glCredit: 0,
          glNet: 0,
          inBalance: false,
          inGL: true
        };
        compMap.set(boal, item);
      } else {
        item.inGL = true;
      }
      item.glCount = Number(g.gl_count || 0);
      item.glDebit = Number(g.gl_debit || 0);
      item.glCredit = Number(g.gl_credit || 0);
      item.glNet = Math.round(Number(g.gl_net || 0) * 100) / 100;
    });

    const missingDesc = Array.from(compMap.values()).filter((x) => !x.desc);
    if (missingDesc.length > 0) {
      const coaRows = await sqlDb.query(
        'SELECT boal_account, scf_account, description FROM ChartOfAccounts'
      );
      const coaMap = new Map<string, Record<string, any>>();
      coaRows.forEach((r) => coaMap.set(String(r.boal_account).trim(), r));
      missingDesc.forEach((x) => {
        const hit = coaMap.get(x.boal);
        if (hit) {
          x.scf = hit.scf_account || x.scf;
          x.desc = hit.description || x.desc;
        }
      });
    }

    let totalGLDebit = 0;
    let totalGLCredit = 0;
    let totalGLNet = 0;
    let totalBalDebit = 0;
    let totalBalCredit = 0;
    let totalBalNet = 0;

    const accountsList: Record<string, any>[] = [];

    compMap.forEach((item) => {
      const diffNet = Math.round((item.glNet - item.balNetMvt) * 100) / 100;
      const diffDebit = Math.round((item.glDebit - item.balDebit) * 100) / 100;
      const diffCredit = Math.round((item.glCredit - item.balCredit) * 100) / 100;
      const absDiff = Math.abs(diffNet);
      const isMatch = absDiff <= 1.0;

      totalGLDebit += item.glDebit;
      totalGLCredit += item.glCredit;
      totalGLNet += item.glNet;
      totalBalDebit += item.balDebit;
      totalBalCredit += item.balCredit;
      totalBalNet += item.balNetMvt;

      accountsList.push({
        ...item,
        diffNet,
        diffDebit,
        diffCredit,
        absDiff,
        isMatch,
        status: isMatch ? 'MATCH' : 'MISMATCH'
      });
    });

    accountsList.sort((a, b) => {
      if (a.isMatch !== b.isMatch) {
        return a.isMatch ? 1 : -1;
      }
      return b.absDiff - a.absDiff;
    });

    const mismatches = accountsList.filter((a) => !a.isMatch);
    const matches = accountsList.filter((a) => a.isMatch);
    const totalDiscrepancy = Math.round(Math.abs(totalGLNet - totalBalNet) * 100) / 100;

    return {
      year: yearNum,
      month: monthNum || 'ALL',
      periodKey: targetPeriod,
      reconciled: mismatches.length === 0,
      totalAccounts: accountsList.length,
      matchedCount: matches.length,
      mismatchedCount: mismatches.length,
      totalGLDebit: Math.round(totalGLDebit * 100) / 100,
      totalGLCredit: Math.round(totalGLCredit * 100) / 100,
      totalGLNet: Math.round(totalGLNet * 100) / 100,
      totalBalDebit: Math.round(totalBalDebit * 100) / 100,
      totalBalCredit: Math.round(totalBalCredit * 100) / 100,
      totalBalNet: Math.round(totalBalNet * 100) / 100,
      totalDiscrepancy,
      mismatchesCount: mismatches.length,
      topMismatches: mismatches.slice(0, 10),
      accounts: accountsList
    };
  }

  async importFBL3NWithDiff(
    filePath: string,
    options: FBL3NImportOptions = {}
  ): Promise<Record<string, unknown>> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable : ${filePath}`);
    }

    const { rows: rawRows } = await SpreadsheetReader.readSpreadsheet(
      filePath,
      options as Record<string, unknown>
    );

    if (!rawRows || rawRows.length === 0) {
      throw new Error('Le fichier Excel FBL3N est vide.');
    }

    const periodsMap = new Map<number, Set<number>>();
    rawRows.forEach((r) => {
      const account = String(r['Compte'] || r['Account'] || '').trim();
      const docNumber = String(r['Nº pièce'] || r['Document Number'] || r['Pièce'] || '').trim();
      if (!account || !docNumber) return;
      const { fiscalYear, fiscalMonth } = fbl3nManager.extractRowPeriod(r);
      if (fiscalYear) {
        if (!periodsMap.has(fiscalYear)) periodsMap.set(fiscalYear, new Set());
        if (fiscalMonth) periodsMap.get(fiscalYear)!.add(fiscalMonth);
      }
    });

    const diffsByPeriod: Record<string, any>[] = [];

    for (const [yr, moSet] of periodsMap.entries()) {
      for (const mo of moSet) {
        const existingStats = await sqlDb.query(`
          SELECT 
            COUNT(*) AS row_count,
            ISNULL(SUM(amount_local), 0) AS total_sum,
            ISNULL(SUM(CASE WHEN amount_local > 0 THEN amount_local ELSE 0 END), 0) AS total_debit,
            ISNULL(SUM(CASE WHEN amount_local < 0 THEN ABS(amount_local) ELSE 0 END), 0) AS total_credit
          FROM FBL3NLineItems
          WHERE fiscal_year = ${yr} AND fiscal_month = ${mo} AND doc_number <> ''
        `);

        const oldStats = existingStats[0] || {
          row_count: 0,
          total_sum: 0,
          total_debit: 0,
          total_credit: 0
        };
        const hasExisting = Number(oldStats.row_count) > 0;

        let newCount = 0;
        let newSum = 0;
        let newDebit = 0;
        let newCredit = 0;

        rawRows.forEach((r) => {
          const account = String(r['Compte'] || r['Account'] || '').trim();
          const docNumber = String(
            r['Nº pièce'] || r['Document Number'] || r['Pièce'] || ''
          ).trim();
          if (!account || !docNumber) return;
          const { fiscalYear, fiscalMonth } = fbl3nManager.extractRowPeriod(r);
          if (fiscalYear === yr && fiscalMonth === mo) {
            newCount++;
            const amt = fbl3nManager.parseAmount(r['Montant en devise interne']);
            newSum += amt;
            if (amt > 0) newDebit += amt;
            if (amt < 0) newCredit += Math.abs(amt);
          }
        });

        const diffCount = newCount - Number(oldStats.row_count);
        const diffSum = Math.round((newSum - Number(oldStats.total_sum)) * 100) / 100;
        const diffDebit = Math.round((newDebit - Number(oldStats.total_debit)) * 100) / 100;
        const diffCredit = Math.round((newCredit - Number(oldStats.total_credit)) * 100) / 100;
        const isIdentical =
          hasExisting &&
          diffCount === 0 &&
          Math.abs(diffSum) < 0.01 &&
          Math.abs(diffDebit) < 0.01;

        diffsByPeriod.push({
          year: yr,
          month: mo,
          periodLabel: `${String(mo).padStart(2, '0')}/${yr}`,
          hasExisting,
          isIdentical,
          action: hasExisting ? 'REPLACED' : 'INSERTED',
          oldCount: Number(oldStats.row_count),
          newCount,
          diffCount,
          oldSum: Math.round(Number(oldStats.total_sum) * 100) / 100,
          newSum: Math.round(newSum * 100) / 100,
          diffSum,
          oldDebit: Math.round(Number(oldStats.total_debit) * 100) / 100,
          newDebit: Math.round(newDebit * 100) / 100,
          diffDebit,
          oldCredit: Math.round(Number(oldStats.total_credit) * 100) / 100,
          newCredit: Math.round(newCredit * 100) / 100,
          diffCredit
        });
      }
    }

    const importRes = await fbl3nManager.importFromExcel(filePath, {
      importMode: options.importMode || 'month',
      clearExisting: false
    });

    const logEntries = diffsByPeriod.map((d) => {
      const msg = d.hasExisting
        ? d.isIdentical
          ? `Période ${d.periodLabel} réimportée : Données strictement identiques (${d.newCount} lignes).`
          : `Période ${d.periodLabel} remplacée : ${d.diffCount >= 0 ? '+' : ''}${d.diffCount} écritures, écart net de ${d.diffSum.toLocaleString('fr-FR')} DZD.`
        : `Période ${d.periodLabel} initialisée : ${d.newCount} écritures enregistrées.`;

      return this.logDiff({
        source: 'FBL3N',
        type: d.isIdentical ? 'INFO' : d.hasExisting ? 'WARNING' : 'SUCCESS',
        period: d.periodLabel,
        title: d.hasExisting
          ? `Remplacement FBL3N (${d.periodLabel})`
          : `Nouvel Import FBL3N (${d.periodLabel})`,
        message: msg,
        details: d
      });
    });

    return {
      success: true,
      file: path.basename(filePath),
      totalRows: rawRows.length,
      insertedCount: importRes.totalInserted,
      diffs: diffsByPeriod,
      notifications: logEntries
    };
  }

  async importBalanceWithDiff(
    filePath: string,
    periodOverride: string | null = null
  ): Promise<Record<string, unknown>> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable : ${filePath}`);
    }

    const parsed = await balanceManager.parseBalanceFile(filePath, periodOverride);
    const periodKey = parsed.periodKey;
    const newRecords = parsed.records;

    const existing = await sqlDb.query(
      `SELECT boal_account, account_desc, report_initial, debit, credit, solde
       FROM GeneralLedgerBalances
       WHERE period_key = '${periodKey.replace(/'/g, "''")}'`
    );

    const oldMap = new Map<string, Record<string, any>>();
    existing.forEach((r) => oldMap.set(String(r.boal_account).trim(), r));
    const hasExisting = oldMap.size > 0;

    let addedAccounts = 0;
    let modifiedAccounts = 0;
    const changedDetails: Record<string, unknown>[] = [];

    let oldTotalSolde = 0;
    existing.forEach((r) => {
      oldTotalSolde += Number(r.solde || 0);
    });

    let newTotalSolde = 0;

    newRecords.forEach((r) => {
      const boal = String(r.boal_account).trim();
      newTotalSolde += r.solde;

      if (!oldMap.has(boal)) {
        addedAccounts++;
        changedDetails.push({
          boal,
          desc: r.account_desc,
          type: 'ADDED',
          oldSolde: 0,
          newSolde: r.solde,
          diff: r.solde
        });
      } else {
        const oldRec = oldMap.get(boal)!;
        const soldeDiff = Math.round((r.solde - Number(oldRec.solde || 0)) * 100) / 100;
        const debitDiff = Math.round((r.debit - Number(oldRec.debit || 0)) * 100) / 100;
        const creditDiff = Math.round((r.credit - Number(oldRec.credit || 0)) * 100) / 100;

        if (
          Math.abs(soldeDiff) > 0.01 ||
          Math.abs(debitDiff) > 0.01 ||
          Math.abs(creditDiff) > 0.01
        ) {
          modifiedAccounts++;
          changedDetails.push({
            boal,
            desc: r.account_desc || oldRec.account_desc,
            type: 'MODIFIED',
            oldSolde: Number(oldRec.solde || 0),
            newSolde: r.solde,
            diff: soldeDiff,
            diffDebit: debitDiff,
            diffCredit: creditDiff
          });
        }
      }
    });

    const isIdentical = hasExisting && addedAccounts === 0 && modifiedAccounts === 0;

    const saveRes = await balanceManager.saveBalanceToDb(
      newRecords,
      periodKey,
      path.basename(filePath)
    );

    const msg = hasExisting
      ? isIdentical
        ? `Balance période ${periodKey} réimportée : Données strictement identiques (${newRecords.length} comptes).`
        : `Balance période ${periodKey} mise à jour : ${modifiedAccounts} comptes modifiés, ${addedAccounts} nouveaux comptes. Écart global solde : ${(newTotalSolde - oldTotalSolde).toLocaleString('fr-FR')} DZD.`
      : `Balance période ${periodKey} initialisée avec ${newRecords.length} comptes.`;

    const logEntry = this.logDiff({
      source: 'BALANCE',
      type: isIdentical ? 'INFO' : hasExisting ? 'WARNING' : 'SUCCESS',
      period: periodKey,
      title: hasExisting
        ? `Mise à jour Balance (${periodKey})`
        : `Nouvel Import Balance (${periodKey})`,
      message: msg,
      details: {
        periodKey,
        hasExisting,
        isIdentical,
        totalAccounts: newRecords.length,
        oldCount: oldMap.size,
        addedAccounts,
        modifiedAccounts,
        oldTotalSolde: Math.round(oldTotalSolde * 100) / 100,
        newTotalSolde: Math.round(newTotalSolde * 100) / 100,
        diffSolde: Math.round((newTotalSolde - oldTotalSolde) * 100) / 100,
        changedDetails: changedDetails.slice(0, 20)
      }
    });

    return {
      success: true,
      file: path.basename(filePath),
      periodKey,
      count: saveRes.count,
      hasExisting,
      isIdentical,
      addedAccounts,
      modifiedAccounts,
      changedDetails,
      notification: logEntry
    };
  }
}

const reconciliationManager = new ReconciliationManager();
export default reconciliationManager;
