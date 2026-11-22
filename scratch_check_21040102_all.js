const sqlDb = require('./sqlDb');

(async () => {
  console.log('--- CHECKING ACCOUNT 21040102 ACROSS ALL MONTHS OF 2026 AND 2025 ---');

  const rows26 = await sqlDb.query("SELECT period_key, boal_account, scf_account, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key LIKE '%2026' AND boal_account = '21040102' ORDER BY period_key");
  console.log('\n2026 movements on 21040102:');
  console.table(rows26);

  const rows25 = await sqlDb.query("SELECT period_key, boal_account, scf_account, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key LIKE '%2025' AND boal_account = '21040102' ORDER BY period_key");
  console.log('\n2025 movements on 21040102:');
  console.table(rows25);

  process.exit(0);
})();
