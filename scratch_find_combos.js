const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key = '012025'
  `);

  const target = 2634383.81;

  // Let's check differences between debits and credits
  // Or check if 2 accounts sum to 2,634,383.81
  console.log('--- 2-account combinations summing to target ---');
  for (let i = 0; i < rows.length; i++) {
    const v1 = Number(rows[i].debit || 0);
    const c1 = Number(rows[i].credit || 0);
    for (let j = i + 1; j < rows.length; j++) {
      const v2 = Number(rows[j].debit || 0);
      const c2 = Number(rows[j].credit || 0);

      if (Math.abs((v1 + v2) - target) < 0.05) {
        console.log(`Debit sum: ${rows[i].boal_account} (${v1}) + ${rows[j].boal_account} (${v2}) = ${v1+v2}`);
      }
      if (Math.abs((c1 + c2) - target) < 0.05) {
        console.log(`Credit sum: ${rows[i].boal_account} (${c1}) + ${rows[j].boal_account} (${c2}) = ${c1+c2}`);
      }
      if (Math.abs((v1 - c2) - target) < 0.05) {
        console.log(`Debit - Credit: ${rows[i].boal_account} (${v1}) - ${rows[j].boal_account} (${c2}) = ${v1-c2}`);
      }
    }
  }

  // Check 3-account combinations
  console.log('\n--- 3-account credit combinations summing to target ---');
  const credits = rows.filter(r => r.credit > 0).map(r => ({ acc: r.boal_account, c: Number(r.credit), desc: r.account_desc }));
  for (let i = 0; i < credits.length; i++) {
    for (let j = i + 1; j < credits.length; j++) {
      for (let k = j + 1; k < credits.length; k++) {
        const sum = credits[i].c + credits[j].c + credits[k].c;
        if (Math.abs(sum - target) < 0.05) {
          console.log(`Credits: ${credits[i].acc} (${credits[i].c}) + ${credits[j].acc} (${credits[j].c}) + ${credits[k].acc} (${credits[k].c}) = ${sum}`);
        }
      }
    }
  }

  // Also check if any supplier credit + other credit = 2634383.81
  // Look at supplier credits:
  // 16010800 credit: 1255959.99
  // 17110102 credit: 1890666.01
  // 15200003 credit: 256716.16
  // 16030110 credit: 151774.13
  // 16000007 credit: 12376.00
  // 15200007 credit: 13500.00
  // 19710001 credit: 474906.39
  console.log('Done searching.');
})();
