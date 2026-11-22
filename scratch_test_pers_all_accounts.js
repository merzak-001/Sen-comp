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

  console.log('=== CERTIFIED ROW 403 (2025) ===');
  console.log(cert403);

  // Let's test the complete list of personnel accounts:
  const allPersAccounts = [
    // 1. Salaires & Rémunérations
    '17300228', '17560002', '17570002', '17570017', '17570018', '17570019', '17300013', '17305019',
    // 2. IRG sur salaires
    '17460003',
    // 3. CNAS & Cotisations
    '17760022', '17310015', '17310016', '17310017', '17310121', '17310123', '17310124', '17310125',
    // 4. Retenues & Mutuelle & Oeuvres sociales
    '17470311', '17470313', '17470355', '17470308', '17470306', '17470303', '17470301', '17470302',
    '17470312', '17470319', '17470320', '17470322', '17570020', '17570021',
    // 5. Jetons & Missions
    '43290061', '44010088'
  ];

  console.log(`\nTesting ${allPersAccounts.length} personnel accounts across 12 months...`);

  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;

    const rows = await sqlDb.query(`
      SELECT boal_account, debit, credit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN ('${allPersAccounts.join("','")}')
    `);

    // Let's check which accounts have non-zero debits this month
    const activeAccs = rows.filter(r => Number(r.debit) > 0);
    const sumDebits = activeAccs.reduce((a, b) => a + Number(b.debit), 0);
    const target = cert403[m - 1];

    console.log(`Month ${mm}: Active accounts = ${activeAccs.length} | Sum Debits = ${sumDebits.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Target = ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Diff = ${(sumDebits - Math.abs(target)).toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }
})();
