const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query("SELECT boal_account, scf_account, account_desc, debit, credit, solde FROM GeneralLedgerBalances WHERE period_key = '012025'");

  const target = 16413689.20;

  // Let's filter accounts that have positive debits
  const cand = rows.filter(r => (Number(r.debit || 0) > 0) && (
    r.boal_account.startsWith('173') ||
    r.boal_account.startsWith('174') ||
    r.boal_account.startsWith('175') ||
    r.boal_account.startsWith('177') ||
    r.boal_account.startsWith('44010088') ||
    r.boal_account.startsWith('43290061') ||
    r.scf_account.startsWith('42') ||
    r.scf_account.startsWith('43')
  )).map(r => ({ acc: r.boal_account, d: Number(r.debit), desc: r.account_desc }));

  console.log(`Testing subset sum for ${cand.length} accounts against target ${target}...`);

  // Recursive search
  const findMatch = (idx, currentSum, chosen) => {
    if (Math.abs(currentSum - target) < 0.05) {
      return chosen;
    }
    if (currentSum > target + 0.05 || idx >= cand.length) return null;

    // Option 1: Include
    const withThis = findMatch(idx + 1, currentSum + cand[idx].d, [...chosen, cand[idx]]);
    if (withThis) return withThis;

    // Option 2: Exclude
    return findMatch(idx + 1, currentSum, chosen);
  };

  const match = findMatch(0, 0, []);
  if (match) {
    console.log('=== EXACT MATCH FOUND! ===');
    let total = 0;
    for (const m of match) {
      console.log(`  ${m.acc} (${m.desc}) : ${m.d.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
      total += m.d;
    }
    console.log('TOTAL:', total.toLocaleString('fr-FR', {minimumFractionDigits: 2}), 'DA');
  } else {
    console.log('No exact subset sum directly. Searching with IRG...');
    // What if IRG is from 17460003: 2,539,076
    // Or check difference
    const totalAll = cand.reduce((a, b) => a + b.d, 0);
    console.log('Total all candidates:', totalAll);
    console.log('Difference:', totalAll - target);
  }
})();
