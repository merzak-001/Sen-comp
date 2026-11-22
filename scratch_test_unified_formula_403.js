const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const row403 = excelData.find(x => String(x[1]).trim() === '403');
  const targets = row403.slice(2, 14).map(v => Math.abs(Number(v) || 0));

  console.log('Testing Universal Formula across all 12 months...\n');

  // Let's test different candidates of a SINGLE fixed formula:
  // Candidate A: Core Net Salaries + Direct Social Charges + IRG
  // Accounts: 
  // 17300228 (Salaires)
  // 17460003 (IRG)
  // 17760022 (CNAS Maladie)
  // 17310015 (CNAS AT)
  // 17310016 (CNAS Retraite)
  // 17310017 (CNAS Mutuelle)
  // 17570018 (Prime performance)
  // 17570019 (Gratification)
  // 17570017 (Conges payes)
  // 17470355 (Oeuvres sociales)
  // 17470311 (Muteg)
  // 17470313 (Fonds d'aide)
  // 17570020 (Retraite ant.)
  // 17570021 (Contrib log.)

  const candidateAccounts = [
    '17300228', // Salaires
    '17460003', // IRG
    '17760022', // CNAS Maladie
    '17310015', // CNAS AT
    '17310016', // CNAS Retraite
    '17310017', // CNAS Mutuelle
    '17570018', // Prime de performance
    '17570019', // Gratification
    '17570017', // Conges payes
    '17470355', // Oeuvres sociales
    '17470311', // Muteg
    '17470313', // Fonds d'aide
    '17570020', // Retraite ant
    '17570021'  // Logement
  ];

  const inList = candidateAccounts.map(a => `'${a}'`).join(',');

  console.log('=== CANDIDATE A: Fixed 14 Core Operational Accounts ===');
  let totalTarget = 0;
  let totalComputed = 0;

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
    const pct = ((diff / target) * 100).toFixed(2);

    totalTarget += target;
    totalComputed += comp;

    console.log(`M${mm}: Target = ${target.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Computed = ${comp.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(14)} | Diff = ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(13)} (${pct}%)`);
  }

  const totDiff = totalComputed - totalTarget;
  console.log(`\nTOTAL 2025: Target = ${totalTarget.toLocaleString('fr-FR')} | Computed = ${totalComputed.toLocaleString('fr-FR')} | Diff = ${totDiff.toLocaleString('fr-FR')} (${((totDiff/totalTarget)*100).toFixed(2)}%)`);

  process.exit(0);
})();
