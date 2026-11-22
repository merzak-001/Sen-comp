const sqlDb = require('./sqlDb');
(async () => {
  const banks = await sqlDb.query("SELECT DISTINCT boal_account, scf_account, account_desc FROM GeneralLedgerBalances WHERE scf_account LIKE '5%' OR account_desc LIKE '%BANQ%' OR account_desc LIKE '%CAISSE%' ORDER BY scf_account");
  console.log('Class 5 accounts in Balance:', banks);

  // Check opening cash and monthly balances for these accounts
  const monthlyCash = await sqlDb.query(`
    SELECT period_key, 
           SUM(report_initial) as total_report,
           SUM(debit) as total_debit,
           SUM(credit) as total_credit,
           SUM(solde) as total_solde
    FROM GeneralLedgerBalances 
    WHERE (scf_account LIKE '512%' OR scf_account LIKE '53%')
    GROUP BY period_key
    ORDER BY period_key
  `);
  console.log('Monthly Cash (512 & 53) in Balance:', monthlyCash);
})();
