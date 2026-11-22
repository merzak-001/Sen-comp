const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const allBalances = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log('=== RUNNING SUBSET SOLVER FOR EACH MONTH OF 2025 ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    // Filter candidate accounts that have positive debit in this month
    // Exclude obvious supplier accounts (401, 404, 408), clients (411), tax IBS (444), bank transfer internal
    const cand = allBalances.filter(r => r.period_key === pKey && Number(r.debit) > 0 && (
      r.boal_account.startsWith('173') ||
      r.boal_account.startsWith('174') ||
      r.boal_account.startsWith('175') ||
      r.boal_account.startsWith('177') ||
      r.scf_account.startsWith('42') ||
      r.scf_account.startsWith('43') ||
      r.scf_account.startsWith('4421') ||
      r.boal_account === '44010088' ||
      r.boal_account === '43290061'
    ) && (
      !r.scf_account.startsWith('408') &&
      !r.scf_account.startsWith('444') &&
      !r.boal_account.startsWith('17470350') &&
      !r.boal_account.startsWith('17470352') &&
      !r.boal_account.startsWith('17470353') &&
      !r.boal_account.startsWith('17760023')
    )).map(r => ({
      acc: r.boal_account,
      scf: r.scf_account,
      desc: r.account_desc,
      d: Math.round(Number(r.debit) * 100) / 100
    }));

    const targetCents = Math.round(target * 100);

    // Meet-in-the-middle or branch and bound to find exact subset
    let bestSubset = null;
    let minDiff = Infinity;

    // Recursive search with pruning
    const search = (idx, currentSum, chosen) => {
      const diff = Math.abs(currentSum - targetCents);
      if (diff < minDiff) {
        minDiff = diff;
        bestSubset = chosen;
        if (diff === 0) return true;
      }
      if (idx >= cand.length || currentSum > targetCents + 500000) return false;

      // Try including cand[idx]
      const val = Math.round(cand[idx].d * 100);
      if (search(idx + 1, currentSum + val, [...chosen, cand[idx]])) return true;

      // Try excluding cand[idx]
      if (search(idx + 1, currentSum, chosen)) return true;

      return false;
    };

    // Sort descending by debit
    cand.sort((a, b) => b.d - a.d);

    search(0, 0, []);

    const diffDA = minDiff / 100;
    console.log(`Month ${mm}/2025: Target = ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Min Diff = ${diffDA.toFixed(2)} DA | Accounts Count: ${bestSubset ? bestSubset.length : 0}`);
    if (bestSubset && diffDA < 5.0) {
      console.log(`  EXACT MATCH: ` + bestSubset.map(c => `${c.acc}(${c.d})`).join(', '));
    }
  }

  process.exit(0);
})();
