const fs = require('fs');
const XLSX = require('xlsx');
const path = require('path');

const dir = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

for (const file of files) {
  try {
    const filePath = path.join(dir, file);
    const wb = XLSX.readFile(filePath, { cellFormula: true });
    wb.SheetNames.forEach(sName => {
      const ws = wb.Sheets[sName];
      if (!ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (!cell) continue;
          const valStr = String(cell.v || '');
          const fStr = String(cell.f || '');
          if (valStr.includes('13794') || fStr.includes('13794') || valStr.includes('242430317') || fStr.includes('242430317')) {
            console.log('Found in [' + file + '] Sheet [' + sName + '] Cell [' + XLSX.utils.encode_cell({ r, c }) + ']: val=' + cell.v + ', formula=' + cell.f);
          }
        }
      }
    });
  } catch (e) {}
}
