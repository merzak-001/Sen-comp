const sqlDb = require('./sqlDb');

(async () => {
  const gl0125 = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  console.log('--- Checking 404 (175,746.88) ---');
  // Usually bank commissions (627 / 26020100) or interest (661)
  const bqFees = gl0125.filter(r => r.scf_account.startsWith('627') || r.scf_account.startsWith('661') || r.boal_account.startsWith('2602'));
  for (const r of bqFees) {
    console.log(`Bq fee: ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${r.debit}, Credit=${r.credit}, Solde=${r.solde}`);
  }

  console.log('\n--- Checking 403 Personnel (16,413,689.20) ---');
  // Personnel payment accounts: 17300010, 17300015, 17310xxx, 421xxx, 431xxx
  const persAccounts = gl0125.filter(r => r.boal_account.startsWith('173') || r.scf_account.startsWith('42') || r.scf_account.startsWith('43'));
  let totDebPers = 0;
  for (const r of persAccounts) {
    if (r.debit > 0) {
      console.log(`Pers: ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${r.debit}`);
      totDebPers += Number(r.debit);
    }
  }
  console.log('Total Debits Personnel accounts:', totDebPers);
})();
