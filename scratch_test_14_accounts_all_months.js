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

  const exactMatchAccs = [
    '17300228', // Net salaries paid
    '17460003', // IRG sur salaires
    '17760022', // CNAS Maladie
    '17300013', // Diverses charges personnel
    '17310016', // CNAS Retraite
    '17570017', // Conges payes
    '17305019', // Charges constatees d'avance
    '17310015', // CNAS Accident
    '17470355', // Oeuvres sociales
    '17470303', // Retenues vacances
    '17570021', // Contribution logement social
    '17470301', // Retenues prets logements
    '17470312', // Retenues assurances
    '17470319'  // Retenues mariage
  ];

  console.log('=== TESTING 14 VERIFIED ACCOUNTS ACROSS 2025 ===');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const accList = exactMatchAccs.map(a => `'${a}'`).join(',');
    const rows = await sqlDb.query(`SELECT boal_account, debit FROM GeneralLedgerBalances WHERE period_key = '${pKey}' AND boal_account IN (${accList})`);
    const sum = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const target = Math.abs(cert403[m-1]);
    const diff = sum - target;
    console.log(`Month ${mm}: Formula=${sum.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Target=${target.toLocaleString('fr-FR', {minimumFractionDigits: 2})} | Diff=${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2})}`);
  }

  console.log('\n=== TESTING 14 VERIFIED ACCOUNTS FOR 2026 ===');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2026`;
    const accList = exactMatchAccs.map(a => `'${a}'`).join(',');
    const rows = await sqlDb.query(`SELECT boal_account, debit FROM GeneralLedgerBalances WHERE period_key = '${pKey}' AND boal_account IN (${accList})`);
    const sum = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    if (sum > 0) {
      console.log(`Month ${mm}/2026: Row 403 = -${sum.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
    }
  }
})();
