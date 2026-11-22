const sqlDb = require('./sqlDb');

(async () => {
  const pKey = '022025';
  const target = 16777848.10;

  const rows = await sqlDb.query(`
    SELECT boal_account, scf_account, account_desc, debit, credit 
    FROM GeneralLedgerBalances 
    WHERE period_key = '${pKey}' AND debit > 0 AND (
      boal_account LIKE '173%' OR 
      boal_account LIKE '174%' OR 
      boal_account LIKE '175%' OR 
      boal_account LIKE '177%' OR 
      scf_account LIKE '42%' OR 
      scf_account LIKE '43%' OR 
      scf_account LIKE '4421%'
    ) AND (
      NOT scf_account LIKE '408%' AND
      NOT scf_account LIKE '444%' AND
      NOT scf_account LIKE '447%'
    )
  `);

  const cand = rows.map(r => ({
    acc: r.boal_account,
    desc: r.account_desc,
    val: Math.round(Number(r.debit) * 100)
  }));

  const targetCents = Math.round(target * 100);

  console.log(`Testing meet-in-the-middle on ${cand.length} accounts for target ${target}...`);

  // Split into left and right
  const mid = Math.floor(cand.length / 2);
  const left = cand.slice(0, mid);
  const right = cand.slice(mid);

  // Generate all subsets of left
  const leftMap = new Map();
  const nL = left.length;
  for (let mask = 0; mask < (1 << nL); mask++) {
    let s = 0;
    for (let i = 0; i < nL; i++) {
      if ((mask >> i) & 1) s += left[i].val;
    }
    if (!leftMap.has(s)) leftMap.set(s, mask);
  }

  console.log(`Generated ${leftMap.size} left subset sums.`);

  // Check with right
  const nR = right.length;
  let bestDiff = Infinity;
  let bestMatch = null;

  for (let mask = 0; mask < (1 << nR); mask++) {
    let sR = 0;
    for (let i = 0; i < nR; i++) {
      if ((mask >> i) & 1) sR += right[i].val;
    }

    const needed = targetCents - sR;
    if (leftMap.has(needed)) {
      const maskL = leftMap.get(needed);
      bestDiff = 0;
      bestMatch = { maskL, maskR: mask };
      break;
    }
  }

  if (bestMatch && bestDiff === 0) {
    console.log('=== EXACT MATCH FOUND IN MONTH 2! ===');
    const chosen = [];
    let tot = 0;
    for (let i = 0; i < nL; i++) {
      if ((bestMatch.maskL >> i) & 1) {
        chosen.push(left[i]);
        tot += left[i].val;
      }
    }
    for (let i = 0; i < nR; i++) {
      if ((bestMatch.maskR >> i) & 1) {
        chosen.push(right[i]);
        tot += right[i].val;
      }
    }
    console.log(`Total chosen accounts: ${chosen.length}`);
    chosen.forEach(c => console.log(`  ${c.acc} (${c.desc}): ${(c.val / 100).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`));
    console.log(`SUM: ${(tot / 100).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA)`);
  } else {
    console.log('No exact subset directly from debits of these candidate accounts.');
    // Let's find the closest subset
    const leftKeys = Array.from(leftMap.keys()).sort((a, b) => a - b);
    for (let mask = 0; mask < (1 << nR); mask++) {
      let sR = 0;
      for (let i = 0; i < nR; i++) {
        if ((mask >> i) & 1) sR += right[i].val;
      }
      const needed = targetCents - sR;
      // Binary search for closest
      let low = 0, high = leftKeys.length - 1;
      while (low <= high) {
        const m = Math.floor((low + high) / 2);
        const diff = Math.abs(leftKeys[m] - needed);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = { maskL: leftMap.get(leftKeys[m]), maskR: mask };
        }
        if (leftKeys[m] < needed) low = m + 1;
        else high = m - 1;
      }
    }
    console.log(`Closest match diff: ${(bestDiff / 100).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
    const chosen = [];
    let tot = 0;
    for (let i = 0; i < nL; i++) {
      if ((bestMatch.maskL >> i) & 1) {
        chosen.push(left[i]);
        tot += left[i].val;
      }
    }
    for (let i = 0; i < nR; i++) {
      if ((bestMatch.maskR >> i) & 1) {
        chosen.push(right[i]);
        tot += right[i].val;
      }
    }
    chosen.forEach(c => console.log(`  ${c.acc} (${c.desc}): ${(c.val / 100).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`));
    console.log(`SUM: ${(tot / 100).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  }

  process.exit(0);
})();
