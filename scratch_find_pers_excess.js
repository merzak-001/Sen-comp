const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets2025 = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const accounts14 = [
    '17300228', '17460003', '17760022', '17300013', '17310016',
    '17570017', '17305019', '17310015', '17470355', '17470303',
    '17570021', '17470301', '17470312', '17470319'
  ];

  console.log('=== BREAKDOWN OF THE 14 ACCOUNTS ACROSS ALL 12 MONTHS OF 2025 ===\n');

  // Let's sum debits of each account across the full year
  const accTotals = {};
  for (const a of accounts14) accTotals[a] = 0;

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets2025[m - 1];

    const q = await sqlDb.query(`
      SELECT boal_account, account_desc, debit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN ('${accounts14.join("','")}')
    `);

    let mSum = 0;
    q.forEach(r => {
      const d = Number(r.debit || 0);
      mSum += d;
      accTotals[r.boal_account] += d;
    });

    const diff = mSum - target;
    console.log(`M${mm}/2025 | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Formula: ${mSum.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  console.log('\n=== ANNUAL TOTALS BY ACCOUNT IN 2025 ===');
  let totAll = 0;
  for (const a of accounts14) {
    const tot = accTotals[a];
    totAll += tot;
    console.log(`  ${a.padEnd(12)}: ${tot.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} DA`);
  }
  console.log(`\nTOTAL 14 ACCOUNTS: ${totAll.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`EXCEL TARGET     : 301.314.508,18 DA`);
  console.log(`EXCESS           : ${(totAll - 301314508.18).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);

  process.exit(0);
})();
