const sqlDb = require('./sqlDb');

(async () => {
  const q = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit 
    FROM GeneralLedgerBalances 
    WHERE period_key = '012025' AND debit > 0 AND (
      boal_account LIKE '173%' OR 
      boal_account LIKE '174%' OR 
      boal_account LIKE '175%' OR 
      boal_account LIKE '177%'
    ) AND (
      NOT scf_account LIKE '408%' AND
      NOT scf_account LIKE '444%'
    )
    ORDER BY debit DESC
  `);
  console.log('=== ALL PERSONNEL DEBITS IN 01/2025 ===');
  console.table(q);
  process.exit(0);
})();
