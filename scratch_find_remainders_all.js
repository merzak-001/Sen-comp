const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const targets = tftData.find(x => String(x[1]).trim() === '403').slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const allRows = await sqlDb.query(`
    SELECT period_key, boal_account, scf_account, account_desc, debit, credit, solde
    FROM GeneralLedgerBalances
    WHERE period_key LIKE '%2025'
  `);

  console.log('=== MATCHING REMAINDER ACCOUNTS FOR EACH MONTH ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const baseAccs = ['17300228', '17460003', '17760022', '17310016', '17310015'];
    const baseSum = allRows
      .filter(r => r.period_key === pKey && baseAccs.includes(r.boal_account))
      .reduce((s, r) => s + Number(r.debit || 0), 0);

    const remainder = target - baseSum;

    // Candidate accounts for remainder: all other accounts with debits in this month
    const candidates = allRows
      .filter(r => r.period_key === pKey && !baseAccs.includes(r.boal_account) && Number(r.debit) > 0)
      .map(r => ({ acc: r.boal_account, scf: r.scf_account, desc: r.account_desc, deb: Number(r.debit) }))
      .filter(r => !r.scf.startsWith('408') && !r.scf.startsWith('444') && !r.acc.startsWith('17760023'));

    // Check if any single candidate matches remainder
    const exact1 = candidates.filter(c => Math.abs(c.deb - remainder) < 1.0);
    console.log(`Month ${mm} (Remainder: ${remainder.toLocaleString('fr-FR', {minimumFractionDigits:2})} DA):`);

    // Find best combination
    const sorted = candidates.sort((a, b) => b.deb - a.deb);
    for (const c of sorted.slice(0, 6)) {
      console.log(`   [cand] ${c.acc} (${c.scf} - ${c.desc}): ${c.deb.toLocaleString('fr-FR', {minimumFractionDigits:2})} DA`);
    }
    console.log('');
  }

  process.exit(0);
})();
