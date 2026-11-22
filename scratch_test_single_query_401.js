const sqlDb = require('./sqlDb');

(async () => {
  const y = 2026;
  const m401 = new Array(12).fill(0);

  let prevRecAdvSolde = 0;

  for (let m = 0; m < 12; m++) {
    const mm = String(m + 1).padStart(2, '0');
    const pKey = `${mm}${y}`;

    const q = await sqlDb.query(`
      SELECT 
        -- Local Sales HT: 88010031 + 88010053 + 88010039
        ISNULL(SUM(CASE WHEN boal_account IN ('88010031', '88010053', '88010039') OR scf_account IN ('701100000', '700100000', '708801000') THEN (credit - debit) ELSE 0 END), 0) as local_sales_ht,
        
        -- Foreign Client Collection: 14050500 credit
        ISNULL(SUM(CASE WHEN boal_account = '14050500' OR scf_account = '411300000' THEN credit ELSE 0 END), 0) as foreign_credit,

        -- Local Receivables & Advances Solde: 14000010 + 14000030 + 14060016
        ISNULL(SUM(CASE WHEN boal_account IN ('14000010', '14000030', '14060016') OR scf_account IN ('411100000', '411120000', '419100000') THEN solde ELSE 0 END), 0) as rec_adv_solde,

        -- Report initial for month 1
        ISNULL(SUM(CASE WHEN boal_account IN ('14000010', '14000030', '14060016') OR scf_account IN ('411100000', '411120000', '419100000') THEN report_initial ELSE 0 END), 0) as rec_adv_report,

        ISNULL(SUM(CASE WHEN (scf_account LIKE '411%' OR scf_account LIKE '418%' OR boal_account LIKE '140%') THEN credit ELSE 0 END), 0) as client_credit
      FROM GeneralLedgerBalances
      WHERE period_key = '${pKey}'
    `);

    const r = q && q[0] ? q[0] : {};
    const localSalesHT = Number(r.local_sales_ht) || 0;
    const foreignCredit = Number(r.foreign_credit) || 0;
    const currentSolde = Number(r.rec_adv_solde) || 0;
    const reportInitial = Number(r.rec_adv_report) || 0;
    const clientCredit = Number(r.client_credit) || 0;

    const openingSolde = (m === 0) ? reportInitial : prevRecAdvSolde;
    const deltaRecAdv = currentSolde - openingSolde;
    prevRecAdvSolde = currentSolde;

    const localSalesTTC = localSalesHT * 1.19;

    let encaissements = 0;
    if (localSalesHT !== 0 || deltaRecAdv !== 0 || foreignCredit !== 0) {
      encaissements = localSalesTTC - deltaRecAdv + foreignCredit;
    } else {
      encaissements = clientCredit;
    }

    m401[m] = encaissements;
    console.log(`Month ${m + 1}: SalesHT=${localSalesHT.toFixed(2)} | Delta=${deltaRecAdv.toFixed(2)} | Foreign=${foreignCredit.toFixed(2)} | Row401=${encaissements.toFixed(2)}`);
  }

  process.exit(0);
})();
