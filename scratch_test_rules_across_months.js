const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  const list14 = [
    '17300228', '17460003', '17760022', '17300013', '17310016',
    '17570017', '17305019', '17310015', '17470355', '17470303',
    '17570021', '17470301', '17470312', '17470319'
  ];

  console.log('=== TESTING 14 ACCOUNTS ACROSS 12 MONTHS OF 2025 ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const q = await sqlDb.query(`
      SELECT boal_account, account_desc, debit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN ('${list14.join("','")}')
    `);

    const sumDeb = q.reduce((s, r) => s + Number(r.debit || 0), 0);
    const diff = sumDeb - target;

    console.log(`M${mm}/2025 | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Sum 14: ${sumDeb.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  process.exit(0);
})();
