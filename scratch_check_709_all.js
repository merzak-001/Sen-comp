const sqlDb = require('./sqlDb');

(async () => {
  console.log('--- MOVEMENTS ON 83006003 (709000000 - RRR ACCORDEES) IN 2025 & 2026 ---');

  const rows = await sqlDb.query("SELECT period_key, boal_account, scf_account, debit, credit, solde FROM GeneralLedgerBalances WHERE boal_account = '83006003' OR scf_account = '709000000' ORDER BY period_key");
  console.table(rows);

  process.exit(0);
})();
