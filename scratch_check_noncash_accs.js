const sqlDb = require('./sqlDb');

(async () => {
  const pCurr = '012025';
  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '" + pCurr + "'");

  const getRow = (acc) => rows.find(x => x.boal_account === acc) || {};

  console.log('=== EXACT ACCOUNTS OF NON-CASH REGULARIZATIONS ===');
  const accs = ['16010800', '19710001', '21040102', '15200003', '16030110', '15200007', '16000007'];

  let totalCredit = 0;
  for (const a of accs) {
    const r = getRow(a);
    const c = Number(r.credit || 0);
    const d = Number(r.debit || 0);
    console.log(`${a} (${r.scf_account} - ${r.account_desc}) => Debit: ${d}, Credit: ${c}, Solde: ${r.solde}`);
  }

  // Notice:
  // In supplier accounts, Debits are payments.
  // Credits are invoices OR credit adjustments.
  // When you pay suppliers, the net payment is (Debits - Credits of foreign suppliers/advances/guarantees).
})();
