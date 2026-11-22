const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== INVESTIGATING MARS 2025 (PERIOD 032025) IN GENERAL LEDGER BALANCES ===\n');

  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022025'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032025'");

  console.log(`Loaded 022025 (${p2.length} accounts) and 032025 (${p3.length} accounts).`);

  // Helper
  const getAcc = (p, boal) => p.find(r => r.boal_account === boal) || { debit:0, credit:0, solde:0, report_initial:0 };

  // 1. ALL SALES ACCOUNTS in 032025
  const sales3 = p3.filter(r => (r.scf_account && r.scf_account.startsWith('70')) || (r.boal_account && r.boal_account.startsWith('88')));
  console.log('--- SALES ACCOUNTS IN 032025 ---');
  let sumSalesHT = 0;
  sales3.forEach(s => {
    const net = Number(s.credit || 0) - Number(s.debit || 0);
    console.log(`${s.boal_account} | SCF: ${s.scf_account} | ${s.account_desc.padEnd(30)} | Debit: ${s.debit} | Credit: ${s.credit} | Net: ${net}`);
    sumSalesHT += net;
  });
  console.log('Total Sales Net HT:', sumSalesHT);
  console.log('Total Sales TTC (* 1.19):', sumSalesHT * 1.19);

  // 2. ALL CLIENT ACCOUNTS in 032025 vs 022025
  const clients3 = p3.filter(r => 
    (r.boal_account && (r.boal_account.startsWith('140') || r.boal_account.startsWith('280') || r.boal_account.startsWith('411'))) ||
    (r.scf_account && (r.scf_account.startsWith('411') || r.scf_account.startsWith('418') || r.scf_account.startsWith('419')))
  );

  console.log('\n--- CLIENT & RECEIVABLE ACCOUNTS IN 032025 vs 022025 ---');
  clients3.forEach(c => {
    const c2 = getAcc(p2, c.boal_account);
    const deltaSolde = Number(c.solde || 0) - Number(c2.solde || 0);
    console.log(`${c.boal_account} | SCF: ${c.scf_account} | ${c.account_desc.padEnd(30)} | Solde Feb: ${c2.solde} | Solde Mar: ${c.solde} | Delta: ${deltaSolde} | M3 Debit: ${c.debit} | M3 Credit: ${c.credit}`);
  });

  // 3. TARGET: 242,430,317.89
  const target = 242430317.89;
  console.log('\nTarget Row 401 Mars 2025:', target);

  process.exit(0);
})();
