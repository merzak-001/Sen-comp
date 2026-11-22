const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query("SELECT period_key, boal_account, scf_account, report_initial, debit, credit, solde FROM GeneralLedgerBalances WHERE boal_account = '88010031' AND period_key LIKE '%2026' ORDER BY period_key");
  console.table(rows);
  process.exit(0);
})();
