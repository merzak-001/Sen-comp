const sqlDb = require('./sqlDb');

(async () => {
  console.log('--- TVA COLLECTEE ACCOUNTS IN 032025 ---');
  const tva = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025' AND (scf_account LIKE '4457%' OR boal_account LIKE '243%' OR scf_account LIKE '445%')");
  tva.forEach(t => {
    console.log(`${t.boal_account} | ${t.scf_account} | ${t.account_desc} | Deb: ${t.debit} | Crd: ${t.credit} | Solde: ${t.solde}`);
  });

  // Also check if there are other Class 70 accounts in 032025
  const all70 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025' AND (scf_account LIKE '7%' OR boal_account LIKE '88%')");
  console.log('\n--- ALL REVENUE ACCOUNTS IN 032025 ---');
  all70.forEach(s => {
    console.log(`${s.boal_account} | ${s.scf_account} | ${s.account_desc} | Deb: ${s.debit} | Crd: ${s.credit} | Solde: ${s.solde}`);
  });

  process.exit(0);
})();
