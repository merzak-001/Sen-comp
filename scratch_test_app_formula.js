const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  // The full operational personnel accounts list
  const accounts = [
    '17300228', // Salaires nets
    '17460003', // IRG
    '17760022', // CNAS Maladie
    '17310015', // CNAS AT
    '17310016', // CNAS Retraite
    '17310017', // CNAS Mutuelle
    '17310121', // CNAS 9% Securite
    '17310123', // CNAS 9% Retraite
    '17310124', // CNAS Retenues Assurance
    '17310125', // CNAS Retenues Retraite
    '17570018', // Prime de performance
    '17570019', // Gratification
    '17570017', // Conges payes
    '17570020', // Retraite ant
    '17570021', // Logement
    '17470355', // Oeuvres sociales
    '17470311', // Muteg
    '17470313', // Fonds d'aide
    '17470301', '17470302', '17470303', '17470306', '17470308', '17470312', '17470319', '17470320', '17470322'
  ];

  const inList = accounts.map(a => `'${a}'`).join(',');

  console.log('--- TEST 1: RAW DEBIT OF ALL OPERATIONAL PERSONNEL ACCOUNTS ---');
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const pKey = `${mm}2025`;
    const target = targets[m - 1];

    const rows = await sqlDb.query(`
      SELECT SUM(debit) as totDebit 
      FROM GeneralLedgerBalances 
      WHERE period_key = '${pKey}' AND boal_account IN (${inList})
    `);

    const comp = Number(rows[0].totDebit) || 0;
    const diff = comp - target;
    console.log(`M${mm}: Target = ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Raw Debit = ${comp.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff = ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)}`);
  }

  process.exit(0);
})();
