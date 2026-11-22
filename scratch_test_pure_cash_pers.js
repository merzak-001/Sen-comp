const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = tftData.find(x => String(x[1]).trim() === '403');
  const targets2025 = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  // Exclude accrual/provision accounts (17305019 CCA, 17470355 Prov oeuvres soc, 17570017 Prov conge)
  const directCashPersAccounts = [
    '17300228', // Net salaries paid
    '17460003', // IRG sur salaires
    '17760022', // CNAS Maladie
    '17310016', // CNAS Retraite
    '17310015', // CNAS Accident
    '17300013', // Charges diverses
    '17470303', // Retenues vacances
    '17570021', // Contribution logement social
    '17470301', // Retenues prets logements
    '17470312', // Retenues assurances
    '17470319'  // Retenues mariage
  ];

  console.log('=== TESTING CASH-ONLY PAYROLL ACCOUNTS (NO PROVISIONS/ACCRUALS) ===\n');

  let totAnnual = 0;
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets2025[m - 1];

    const q = await sqlDb.query(`
      SELECT SUM(debit) as deb 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN ('${directCashPersAccounts.join("','")}')
    `);

    const mDeb = Number(q[0]?.deb || 0);
    totAnnual += mDeb;
    const diff = mDeb - target;
    console.log(`M${mm}/2025 | Target: ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Cash Pers: ${mDeb.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  const targetTot = 301314508.18;
  console.log(`\nANNUAL TOTAL CASH PERS: ${totAnnual.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`EXCEL ANNUAL TARGET   : ${targetTot.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`DIFFERENCE            : ${(totAnnual - targetTot).toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (${(((totAnnual - targetTot) / targetTot) * 100).toFixed(2)}%)`);

  process.exit(0);
})();
