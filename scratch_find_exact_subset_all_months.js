const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('=== SYSTEMATIC SUBSET REVERSE-ENGINEERING FOR ALL 12 MONTHS OF ROW 403 ===\n');

  const monthlyResults = [];

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

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
      val: Math.round(Number(r.debit) * 100),
      origVal: Number(r.debit)
    }));

    const targetCents = Math.round(target * 100);

    const mid = Math.floor(cand.length / 2);
    const left = cand.slice(0, mid);
    const right = cand.slice(mid);

    const leftMap = new Map();
    const nL = left.length;
    for (let mask = 0; mask < (1 << nL); mask++) {
      let s = 0;
      for (let i = 0; i < nL; i++) {
        if ((mask >> i) & 1) s += left[i].val;
      }
      if (!leftMap.has(s)) leftMap.set(s, mask);
    }

    const nR = right.length;
    let bestDiff = Infinity;
    let bestMatch = null;

    const leftKeys = Array.from(leftMap.keys()).sort((a, b) => a - b);
    for (let mask = 0; mask < (1 << nR); mask++) {
      let sR = 0;
      for (let i = 0; i < nR; i++) {
        if ((mask >> i) & 1) sR += right[i].val;
      }
      const needed = targetCents - sR;

      let low = 0, high = leftKeys.length - 1;
      while (low <= high) {
        const midIdx = Math.floor((low + high) / 2);
        const diff = Math.abs(leftKeys[midIdx] - needed);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestMatch = { maskL: leftMap.get(leftKeys[midIdx]), maskR: mask };
          if (diff === 0) break;
        }
        if (leftKeys[midIdx] < needed) low = midIdx + 1;
        else high = midIdx - 1;
      }
      if (bestDiff === 0) break;
    }

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

    const diffDA = (bestDiff / 100);
    const sumDA = (tot / 100);

    monthlyResults.push({
      month: mm,
      target,
      sum: sumDA,
      diff: diffDA,
      chosen
    });

    console.log(`========================================================================`);
    console.log(`MONTH ${mm}/2025: Target = ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA | Found Sum = ${sumDA.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA | Diff = ${diffDA.toFixed(2)} DA`);
    console.log(`ACCOUNTS INCLUDED (${chosen.length} accounts):`);
    chosen.forEach(c => {
      console.log(`   + ${c.acc} (${c.desc.slice(0, 25).padEnd(25)}): ${c.origVal.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} DA`);
    });
    console.log(`FORMULA M${mm} = ` + chosen.map(c => c.acc).join(' + '));
    const fs = require('fs');
    fs.writeFileSync('scratch_403_exact_breakdown.json', JSON.stringify(monthlyResults, null, 2));
    console.log('Saved scratch_403_exact_breakdown.json successfully.');
  }

  process.exit(0);
})();
