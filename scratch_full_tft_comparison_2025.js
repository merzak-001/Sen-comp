const reportingEngine = require('./reportingEngine');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const rep = await reportingEngine.getTFTReport('2025', 'ALL');

  console.log('=== COMPARISON: GENERATED TFT 2025 vs EXCEL TFT DEC 2025 ===\n');

  // Notes to compare
  const notes = ['401', '402', '403', '404', '405', '406', '408', '410', '411', '412', '413', '414', '416', '419', '423', '422', '424', '425', '426', '427'];

  for (const note of notes) {
    const genRow = rep.rows.find(r => r.note === note);
    const excelRow = excelData.find(r => String(r[1]).trim() === note);

    const genTot = genRow ? Number(genRow.tot || 0) : 0;
    const excelTot = excelRow ? Number(excelRow[14] || 0) : 0;
    const diff = genTot - excelTot;

    const label = genRow ? genRow.label : (excelRow ? excelRow[0] : note);

    console.log(`Note ${note.padEnd(4)} | ${label.slice(0, 38).padEnd(40)} | Gen: ${genTot.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(18)} | Excel: ${excelTot.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(18)} | Diff: ${diff.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)}`);
  }

  process.exit(0);
})();
