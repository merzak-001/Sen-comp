const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const dir = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';
const files = fs.readdirSync(dir);

console.log('Searching in OS-appro files for 348430299 or 348 430...');

for (const f of files) {
  const full = path.join(dir, f);
  if (f.endsWith('.xlsx') || f.endsWith('.xls')) {
    try {
      const wb = XLSX.readFile(full);
      for (const s of wb.SheetNames) {
        const ws = wb.Sheets[s];
        const str = JSON.stringify(XLSX.utils.sheet_to_json(ws));
        if (str.includes('348430') || str.includes('348 430') || str.includes('348.430')) {
          console.log(`FOUND IN EXCEL: ${f} -> Sheet ${s}!`);
        }
      }
    } catch (e) {}
  } else if (f.endsWith('.docx') || f.endsWith('.txt')) {
    try {
      const content = fs.readFileSync(full, 'latin1');
      if (content.includes('348') && content.includes('430')) {
        console.log(`FOUND IN DOC: ${f}!`);
      }
    } catch (e) {}
  }
}

console.log('Done searching files.');
