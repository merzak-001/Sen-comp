const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== INVESTIGATING ROW 402 FOR MONTH 01/2025 (Certified: -65,059,394.19 DA) ===\n');

  // Let's get all balances for period 012025 and 122024
  const gl0125 = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, report_initial, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  const gl1224 = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '122024'
  `);

  const prevMap = new Map();
  for (const r of gl1224) prevMap.set(r.boal_account, Number(r.solde) || 0);

  // 1. Check Supplier Balance Sheet accounts (16000010, 16010800, 17110102, 16030110, 16000007, 15200003, 15200007, 17470350-58)
  console.log('--- Supplier Accounts in 012025 ---');
  const supplAccounts = ['16000010', '16010800', '17110102', '16030110', '16000007', '15200003', '15200007', '17470350', '17470351', '17470352', '17470353', '17470354', '17470358', '19710001'];
  
  let totDebits = 0, totCredits = 0, totDelta = 0;
  for (const acc of supplAccounts) {
    const row = gl0125.find(r => r.boal_account === acc);
    if (!row) continue;
    const deb = Number(row.debit) || 0;
    const cred = Number(row.credit) || 0;
    const solde = Number(row.solde) || 0;
    const repInit = Number(row.report_initial) || 0;
    const prevSolde = prevMap.has(acc) ? prevMap.get(acc) : repInit;
    const delta = solde - prevSolde;

    totDebits += deb;
    totCredits += cred;
    totDelta += delta;
    console.log(`${acc} (${row.scf_account} - ${row.account_desc}): Report=${prevSolde.toFixed(2)}, Debit=${deb.toFixed(2)}, Credit=${cred.toFixed(2)}, Solde=${solde.toFixed(2)}, Delta=${delta.toFixed(2)}`);
  }
  console.log(`\nSupplier Accounts Totals: Total Debits=${totDebits.toFixed(2)}, Total Credits=${totCredits.toFixed(2)}, Total Delta=${totDelta.toFixed(2)}`);

  // 2. Check Class 60, 61, 62 Expenses
  console.log('\n--- Class 60, 61, 62 Expenses in 012025 ---');
  let sum60 = 0, sum61 = 0, sum62 = 0;
  for (const r of gl0125) {
    const scf = r.scf_account || '';
    const solde = Number(r.solde) || 0;
    const deb = Number(r.debit) || 0;
    const cred = Number(r.credit) || 0;
    const flux = deb - cred;
    if (scf.startsWith('60')) sum60 += flux;
    else if (scf.startsWith('61')) sum61 += flux;
    else if (scf.startsWith('62')) sum62 += flux;
  }
  console.log(`Class 60 (Achats): ${sum60.toFixed(2)}`);
  console.log(`Class 61 (Services): ${sum61.toFixed(2)}`);
  console.log(`Class 62 (Autres services): ${sum62.toFixed(2)}`);
  console.log(`Total 60+61+62: ${(sum60 + sum61 + sum62).toFixed(2)}`);
  console.log(`TTC (x 1.19): ${((sum60 + sum61 + sum62) * 1.19).toFixed(2)}`);

  // 3. Compare with Certified -65,059,394.19
  console.log('\nCertified 402 Month 1: -65,059,394.19 DA');
  console.log('Supplier Account Debits (Payments to suppliers):', totDebits.toFixed(2));
  console.log('Difference Debits vs Certified:', (totDebits - 65059394.19).toFixed(2));
})();
