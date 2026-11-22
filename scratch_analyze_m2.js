const sqlDb = require('./sqlDb');

(async () => {
  const pKey = '022025';
  const target = 16777848.10;

  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit 
    FROM GeneralLedgerBalances 
    WHERE period_key = '${pKey}' AND debit > 0
    ORDER BY debit DESC
  `);

  console.log(`=== MONTH 02/2025 ANALYSIS (Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})}) ===`);

  const persAccounts = [
    '17300228', '17460003', '17760022', '17300013', '17310016',
    '17570017', '17305019', '17310015', '17470355', '17470303',
    '17570021', '17470301', '17470312', '17470319'
  ];

  let sum14 = 0;
  for (const a of persAccounts) {
    const r = rows.find(x => x.boal_account === a);
    const d = r ? Number(r.debit) : 0;
    sum14 += d;
    console.log(`  ${a} (${r?.account_desc}): ${d.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }

  console.log(`\nSum of 14 accounts: ${sum14.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  console.log(`Target            : ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  const diff = sum14 - target;
  console.log(`Diff (Excess)     : ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);

  // Look for any account or combo with debit ~ diff
  console.log('\n--- Accounts with debit close to ' + diff.toFixed(2) + ' ---');
  for (const r of rows) {
    if (Math.abs(Number(r.debit) - diff) < 50000) {
      console.log(`  Close match: ${r.boal_account} (${r.account_desc}): ${Number(r.debit).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
    }
  }

  process.exit(0);
})();
