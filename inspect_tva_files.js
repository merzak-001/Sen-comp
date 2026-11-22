const XLSX = require('xlsx');

const tvaPaths = [
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/tva - 2.xlsx',
  'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/tva 05102026.xlsx'
];

tvaPaths.forEach(p => {
  try {
    const wb = XLSX.readFile(p);
    console.log(`\n=== FILE: ${p} ===`);
    console.log('Sheets:', wb.SheetNames);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
      let row = [];
      for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
        const cell = ws[XLSX.utils.encode_cell({r, c})];
        if (cell && cell.v !== undefined) row.push(`C${c}:${cell.v}`);
      }
      if (row.length > 0) console.log(`R${r+1}: ${row.join(' | ')}`);
    }
  } catch (e) {
    console.log(`Error reading ${p}:`, e.message);
  }
});
