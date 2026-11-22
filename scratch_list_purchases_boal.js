const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT DISTINCT boal_account, scf_account, account_desc 
    FROM GeneralLedgerBalances 
    WHERE scf_account LIKE '60%' OR scf_account LIKE '61%' OR scf_account LIKE '62%'
    ORDER BY boal_account
  `);
  console.log(`Found ${rows.length} accounts:`);
  console.table(rows.slice(0, 30));
  
  // Also check top expense accounts by debit in 012025
  const top = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit
    FROM GeneralLedgerBalances 
    WHERE period_key = '012025' AND (scf_account LIKE '60%' OR scf_account LIKE '61%' OR scf_account LIKE '62%')
    ORDER BY debit DESC
  `);
  console.log('Top 15 expenses in 012025:');
  console.table(top.slice(0, 15));
})();
