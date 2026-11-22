const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');
const exactMatches = require('./scratch_403_exact_breakdown.json');

(async () => {
  console.log('=== COMPARISON: ACCOUNTS EXCLUDED FROM TARGET ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const exactM = exactMatches[m - 1];
    const includedAccs = new Set(exactM.chosen.map(c => c.acc));

    const rows = await sqlDb.query(`
      SELECT boal_account, scf_account, account_desc, debit, credit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND debit > 0 AND (
        scf_account LIKE '42%' OR 
        scf_account LIKE '43%' OR 
        scf_account LIKE '4421%'
      )
    `);

    const excluded = rows.filter(r => !includedAccs.has(r.boal_account));
    if (excluded.length > 0) {
      console.log(`\nMonth ${mm}/2025 (Target: ${exactM.target.toFixed(2)}) - EXCLUDED DEBITS (${excluded.length} accounts):`);
      excluded.forEach(e => {
        console.log(`   - ${e.boal_account} (${(e.account_desc || '').slice(0, 25).padEnd(25)}): Debit = ${Number(e.debit).toFixed(2)} | Credit = ${Number(e.credit).toFixed(2)}`);
      });
    } else {
      console.log(`\nMonth ${mm}/2025: ALL DEBITS INCLUDED!`);
    }
  }

  process.exit(0);
})();
