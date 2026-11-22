const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, solde FROM GeneralLedgerBalances WHERE period_key = '012025' AND (ABS(solde - 9698957.4) < 100 OR ABS(report_initial - 9698957.4) < 100)");
  console.log('Matching 9.69M account:', rows);

  // Check all accounts starting with 5 in 012025
  const all5 = await sqlDb.query("SELECT boal_account, scf_account, account_desc, report_initial, solde FROM GeneralLedgerBalances WHERE period_key = '012025' AND scf_account LIKE '5%'");
  console.log('All Class 5 in 012025:');
  all5.forEach(r => console.log(`${r.boal_account} | ${r.scf_account} | ${r.account_desc} | ouv:${r.report_initial} | solde:${r.solde}`));
})();
