const sqlDb = require('./sqlDb');

(async () => {
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022025'");

  console.log('--- ALL 14* AND 41* ACCOUNTS IN 032025 ---');
  const all14 = p3.filter(r => r.boal_account.startsWith('14') || r.scf_account.startsWith('41'));
  all14.forEach(r => {
    const r2 = p2.find(x => x.boal_account === r.boal_account) || { solde:0, debit:0, credit:0 };
    console.log(`${r.boal_account} | ${r.scf_account} | ${r.account_desc.padEnd(25)} | Solde M-1: ${r2.solde} | Solde M: ${r.solde} | Delta: ${r.solde - r2.solde} | Deb: ${r.debit} | Crd: ${r.credit}`);
  });

  // What about TVA?
  // If TVA was taken as exact TVA Collectée account (17810700):
  // Let's see:
  console.log('\n--- EXACT TVA IN PERIOD 032025 ---');
  const tvaCollectee = p3.find(r => r.boal_account === '17810700');
  console.log('17810700 Credit:', tvaCollectee ? tvaCollectee.credit : 0);

  process.exit(0);
})();
