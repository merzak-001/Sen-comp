const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');

['PE', 'pf,', 'BEA,', 'bea'].forEach(sName => {
  const ws = wb.Sheets[sName];
  if (!ws) return;
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n======================================================`);
  console.log(`SHEET: "${sName}" (Rows: ${data.length})`);
  data.forEach((r, idx) => {
    if (r && r.length > 0) {
      console.log(`  Row ${idx}:`, r);
    }
  });
});
