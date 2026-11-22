const XLSX = require('xlsx');
const p = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(p);

// Let's examine all sheets and their contents
for (const s of wb.SheetNames) {
  const ws = wb.Sheets[s];
  const data = XLSX.utils.sheet_to_json(ws);
  console.log(`Sheet "${s}": ${data.length} rows`);
}
