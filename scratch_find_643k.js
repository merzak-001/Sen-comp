const sqlDb = require('./sqlDb');

(async () => {
  const q = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, SUM(debit) as totDeb 
    FROM GeneralLedgerBalances 
    WHERE period_key LIKE '%2025' 
    GROUP BY boal_account, scf_account, account_desc 
    HAVING SUM(debit) BETWEEN 600000 AND 700000
  `);
  console.table(q);
  process.exit(0);
})();
