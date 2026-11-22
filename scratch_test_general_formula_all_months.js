const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== TESTING GENERAL ROW 401 FORMULA ACROSS ALL MONTHS OF 2026 ===\n');

  // Let's test for year 2026
  const y = 2026;

  // Pre-fetch all balances for 2026 and 12/2025
  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%${y}' OR period_key = '12${y-1}'
  `);

  console.log(`Loaded ${allRows.length} balance records.`);

  const getAcc = (pKey, boal) => {
    return allRows.find(r => r.period_key === pKey && r.boal_account === boal) || { report_initial:0, debit:0, credit:0, solde:0 };
  };

  const results = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pCurr = `${mm}${y}`;
    const pPrev = m === 1 ? `12${y-1}` : `${String(m-1).padStart(2, '0')}${y}`;

    // 1. Sales Local HT = (credit - debit) of 88010031, 88010033, 88010053, 88010039
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

    // 2. Receivables & Advances: 14000010, 14000030, 14060016
    // Delta = Solde(curr) - Solde(prev)
    // Note: for m=1, if 12(y-1) doesn't have it, use report_initial of 01(y)
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

    // 3. Foreign Collection: Account 14050500 Credit
    const cExp = getAcc(pCurr, '14050500');
    const foreignEncaissement = Number(cExp.credit || 0);

    // 4. Formula:
    let r401 = localSalesTTC - deltaReceivablesAndAdv + foreignEncaissement;

    results.push({
      m,
      salesHT: localSalesHT,
      salesTTC: localSalesTTC,
      deltaRecAdv: deltaReceivablesAndAdv,
      foreignCredit: foreignEncaissement,
      r401
    });
  }

  console.table(results.map(r => ({
    Month: r.m,
    Sales_HT: r.salesHT.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Sales_TTC: r.salesTTC.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Delta_Rec_Adv: r.deltaRecAdv.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Foreign_Credit: r.foreignCredit.toLocaleString('fr-FR', {minimumFractionDigits: 2}),
    Row_401: r.r401.toLocaleString('fr-FR', {minimumFractionDigits: 2})
  })));

  process.exit(0);
})();
