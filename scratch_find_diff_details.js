const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  console.log('Searching accounts that explain 2,634,383.81:');
  const target = 2634383.81;

  for (const r of rows) {
    const d = Number(r.debit || 0);
    const c = Number(r.credit || 0);
    const s = Number(r.solde || 0);
    
    // Check difference between debits and credits of supplier accounts
    // e.g. credits of 16010800 + ...
    if (Math.abs(d - target) < 100 || Math.abs(c - target) < 100 || Math.abs(s - target) < 100) {
      console.log('Near match single:', r.boal_account, r.account_desc, d, c, s);
    }
  }

  // Check sum of credits of supplier accounts
  // In 16010800: credit is 1,255,959.99
  // What other credits exist in Class 40?
  const suppl = ['16000010', '16010800', '17110102', '16030110', '16000007', '15200003', '15200007', '19710001'];
  for (const acc of suppl) {
    const r = rows.find(x => x.boal_account === acc);
    if (r) console.log(`Suppl ${acc} (${r.account_desc}): Debit=${r.debit}, Credit=${r.credit}`);
  }

  // What about FX gain on suppliers? (Compte 766 / 21040102 / 28000010)
  const fx = rows.filter(x => x.boal_account.startsWith('28') || x.boal_account.startsWith('2104') || x.scf_account.startsWith('766') || x.scf_account.startsWith('666'));
  console.log('\nFX accounts:');
  for (const r of fx) {
    console.log(`FX ${r.boal_account} (${r.scf_account} - ${r.account_desc}): Debit=${r.debit}, Credit=${r.credit}, Solde=${r.solde}`);
  }
})();
