const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, SUM(debit) as totDeb 
    FROM GeneralLedgerBalances 
    WHERE period_key LIKE '%2025' AND (
      scf_account LIKE '627%' OR 
      scf_account LIKE '661%' OR 
      scf_account LIKE '66%' OR
      boal_account LIKE '2602%'
    )
    GROUP BY boal_account, scf_account, account_desc
    ORDER BY totDeb DESC
  `);

  console.log('=== FINANCIAL FEES AND COMMISSIONS IN 2025 ===');
  console.table(rows);
  const total = rows.reduce((s, r) => s + Number(r.totDeb), 0);
  console.log('Total Debits: ' + total.toLocaleString('fr-FR', {minimumFractionDigits: 2}) + ' DA (Target: 4.276.490,87 DA)');
  process.exit(0);
})();
