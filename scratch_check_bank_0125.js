const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== BANK ACCOUNTS (512 / 11867xxx) IN 01/2025 ===\n');
  const bq = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025' AND (scf_account LIKE '5%' OR boal_account LIKE '11867%' OR boal_account = '10170200')
    ORDER BY boal_account
  `);
  console.table(bq);

  let totReport = 0, totSolde = 0;
  for (const r of bq) {
    totReport += Number(r.report_initial || 0);
    totSolde += Number(r.solde || 0);
  }
  console.log(`Total Trésorerie Ouverture (Report): ${totReport.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`Total Trésorerie Clôture (Solde): ${totSolde.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`Variation Trésorerie (Solde - Report): ${(totSolde - totReport).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);

  // Notice certified:
  // Row 425: 517,706,428.71
  // Row 426: 522,438,115.03
  // Variation: 4,731,686.32
})();
