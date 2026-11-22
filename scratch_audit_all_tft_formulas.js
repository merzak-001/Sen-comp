const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const excelData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const getExcelRow = (note) => {
    const r = excelData.find(x => String(x[1]).trim() === String(note));
    if (!r) return { months: new Array(12).fill(0), tot: 0 };
    return {
      months: r.slice(2, 14).map(v => Number(v) || 0),
      tot: Number(r[14]) || 0
    };
  };

  console.log('=== SYSTEMATIC AUDIT OF ALL TFT ROWS (2025 BENCHMARK vs FORMULAS) ===\n');

  const rowsToAudit = [
    { note: '401', label: 'Encaissements clients' },
    { note: '403', label: 'Sommes versées au personnel' },
    { note: '404', label: 'Intérêts et frais financiers payés' },
    { note: '405', label: 'Impôts sur résultats payés' },
    { note: '410', label: 'Décaissements acquisitions immob.' },
    { note: '411', label: 'Virement aux fonds (DAT)' },
    { note: '412', label: 'Décaissements cautions' },
    { note: '413', label: 'Restitution cautions' },
    { note: '414', label: 'Intérêts encaissés placements' },
    { note: '419', label: 'Dividendes versés' },
    { note: '423', label: 'Variation de change' },
    { note: '425', label: 'Trésorerie ouverture' },
    { note: '426', label: 'Trésorerie clôture' },
    { note: '424', label: 'Variation trésorerie globale' }
  ];

  for (const r of rowsToAudit) {
    const ex = getExcelRow(r.note);
    console.log(`Note ${r.note.padEnd(4)} | ${r.label.padEnd(35)} | Total Excel 2025: ${ex.tot.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(18)} DA`);
  }

  process.exit(0);
})();
