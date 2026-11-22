const XLSX = require('xlsx');

function dumpSheet(filePath, maxR = 25) {
  try {
    const wb = XLSX.readFile(filePath);
    console.log(`\n=== FILE: ${filePath} ===`);
    console.log('Sheets:', wb.SheetNames);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let r = 0; r <= Math.min(range.e.r, maxR); r++) {
      let row = [];
      for (let c = 0; c <= Math.min(range.e.c, 10); c++) {
        const cell = ws[XLSX.utils.encode_cell({r, c})];
        if (cell) row.push(`C${c}:${cell.v}`);
      }
      if (row.length > 0) console.log(`R${r+1}: ${row.join(' | ')}`);
    }
  } catch (e) {
    console.log(`Error reading ${filePath}:`, e.message);
  }
}

dumpSheet('C:/Users/msai/Downloads/depense 06.2026.xlsx', 15);
dumpSheet('C:/Users/msai/Downloads/pai 12.09.2026.xlsx', 15);
dumpSheet('C:/Users/msai/Downloads/pai 16.09.2026.xlsx', 15);
