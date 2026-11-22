const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const range = ws['!ref'] || 'empty';
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const firstRow = data[0] ? data[0].slice(0, 8) : [];
  const secondRow = data[1] ? data[1].slice(0, 8) : [];
  console.log(`Sheet [${name}] | Range: ${range} | Rows: ${data.length}`);
  console.log('   Row 1:', firstRow);
  if (data.length > 1) console.log('   Row 2:', secondRow);
}
