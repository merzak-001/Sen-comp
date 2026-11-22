const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cert403 = [];
  for (let r = 5; r <= 35; r++) {
    const row = tftData[r];
    if (row && String(row[1] || '').trim() === '403') {
      for (let c = 2; c <= 13; c++) cert403.push(Number(row[c]) || 0);
      break;
    }
  }

  const explicitAccounts = [
    '17300228', '17560002', '17570002', '17300013', '17305019', '17570017', '17570018', '17570019',
    '17460003',
    '17760022', '17310015', '17310016', '17310017', '17310121', '17310123', '17310124', '17310125',
    '17470311', '17470313', '17470355', '17470308', '17470306', '17470303', '17470301', '17470302',
    '17470312', '17470319', '17470320', '17470322', '17570020', '17570021',
    '43290061', '44010088'
  ];

  console.log('=== COMPARING PERSONNEL ACCOUNTS VS CERTIFIED ROW 403 ===\n');

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;

    // Query with explicit accounts
    const q1 = await sqlDb.query(`
      SELECT ISNULL(SUM(debit), 0) as val
      FROM GeneralLedgerBalances
      WHERE period_key = '${pKey}' AND boal_account IN ('${explicitAccounts.join("','")}')
    `);
    const valExplicit = Number(q1[0].val);

    // Current query in reportingEngine
    const q2 = await sqlDb.query(`
      SELECT ISNULL(SUM(CASE WHEN (scf_account LIKE '421%' OR scf_account LIKE '422%' OR scf_account LIKE '431%' OR scf_account LIKE '432%' OR boal_account LIKE '173%') THEN debit ELSE 0 END), 0) as val
      FROM GeneralLedgerBalances
      WHERE period_key = '${pKey}'
    `);
    const valCurrent = Number(q2[0].val);

    const target = Math.abs(cert403[m - 1]);

    console.log(`Month ${mm}: Target=${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Explicit=${valExplicit.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Current=${valCurrent.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }
})();
