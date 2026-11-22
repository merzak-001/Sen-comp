const sqlDb = require('../sqlDb');

async function test() {
  const c5 = await sqlDb.query("SELECT boal_account, scf_account, account_desc, solde, debit, credit FROM GeneralLedgerBalances WHERE period_key = '102026' AND (scf_account LIKE '5%' OR boal_account LIKE '11867%' OR boal_account LIKE '15200%')");
  console.log('Class 5 Balances 102026:', c5);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
