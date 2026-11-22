const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  console.log('=== TESTING 2025 FORMULA WITH 83006003 (709000000 - RRR ACCORDEES) ===\n');

  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cert401 = [];
  for (let r = 5; r <= 35; r++) {
    const row = tftData[r];
    if (!row) continue;
    const code = String(row[1] || '').trim();
    if (code === '401') {
      for (let c = 2; c <= 13; c++) cert401.push(Number(row[c]) || 0);
      break;
    }
  }

  const y = 2025;
  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%${y}' OR period_key = '12${y-1}'
  `);

  const getAcc = (pKey, boal) => {
    return allRows.find(r => r.period_key === pKey && r.boal_account === boal) || { report_initial:0, debit:0, credit:0, solde:0 };
  };

  const results = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pCurr = `${mm}${y}`;
    const pPrev = m === 1 ? `12${y-1}` : `${String(m-1).padStart(2, '0')}${y}`;

    // 1. Sales Local HT
    const s31 = getAcc(pCurr, '88010031');
    const s33 = getAcc(pCurr, '88010033');
    const s53 = getAcc(pCurr, '88010053');
    const s39 = getAcc(pCurr, '88010039');

    const ht31 = Number(s31.credit || 0) - Number(s31.debit || 0);
    const ht33 = Number(s33.credit || 0) - Number(s33.debit || 0);
    const ht53 = Number(s53.credit || 0) - Number(s53.debit || 0);
    const ht39 = Number(s39.credit || 0) - Number(s39.debit || 0);

    const localSalesHT = ht31 + ht33 + ht53 + ht39;
    const localSalesTTC = localSalesHT * 1.19;

    const getPrevSolde = (boal) => {
      const prevRow = allRows.find(r => r.period_key === pPrev && r.boal_account === boal);
      if (prevRow && prevRow.solde !== undefined) return Number(prevRow.solde || 0);
      const currRow = getAcc(pCurr, boal);
      return Number(currRow.report_initial || 0);
    };

    const c10_curr = getAcc(pCurr, '14000010');
    const c30_curr = getAcc(pCurr, '14000030');
    const c16_curr = getAcc(pCurr, '14060016');

    const deltaC10 = Number(c10_curr.solde || 0) - getPrevSolde('14000010');
    const deltaC30 = Number(c30_curr.solde || 0) - getPrevSolde('14000030');
    const deltaC16 = Number(c16_curr.solde || 0) - getPrevSolde('14060016');

    const deltaReceivablesAndAdv = deltaC10 + deltaC30 + deltaC16;

    const cExp = getAcc(pCurr, '14050500');
    const foreignEncaissement = Number(cExp.credit || 0);

    // Rebates / RRR accordées (account 83006003 / 709000000):
    const rrr = getAcc(pCurr, '83006003');
    const rrrAmt = Number(rrr.debit || 0) - Number(rrr.credit || 0);

    let r401 = localSalesTTC - deltaReceivablesAndAdv + foreignEncaissement - rrrAmt;
    const cert = cert401[m - 1] || 0;

    results.push({
      m,
      salesHT: localSalesHT,
      salesTTC: localSalesTTC,
      deltaRecAdv: deltaReceivablesAndAdv,
      foreignCredit: foreignEncaissement,
      rrr: rrrAmt,
      r401,
      cert,
      diff: r401 - cert
    });
  }

  console.table(results.map(r => ({
    Month: r.m,
    Calculated_401: r.r401.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Certified_401: r.cert.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    RRR_83006003: r.rrr.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Diff: r.diff.toLocaleString('fr-FR', {minimumFractionDigits: 2})
  })));

  process.exit(0);
})();
