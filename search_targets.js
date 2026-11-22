const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });

const targets = [
  { note: '401 Dec', val: 356257225.23 },
  { note: '402 Dec', val: -193127411.23 },
  { note: '403 Dec', val: -18698570.82 },
  { note: '404 Dec', val: -265516.10 },
  { note: '405 Dec', val: -15537623.00 },
  { note: '410 Dec', val: -6173906.02 },
  { note: '412 Dec', val: -4530422.67 },
  { note: '413 Dec', val: 5037508.00 },
  { note: '423 Dec', val: 113431.01 },
  { note: '401 Nov', val: 213036605.00 },
  { note: '402 Nov', val: -106346847.76 },
  { note: '403 Nov', val: -23618842.86 },
  { note: '405 Nov', val: -39678115.00 },
  { note: '412 Nov', val: -2465917.40 },
  { note: '413 Nov', val: 1232958.40 }
];

console.log('=== SEARCHING TARGET NUMBERS ACROSS ALL SHEETS ===');

wb.SheetNames.forEach(sheetName => {
  if (sheetName === 'TFT 2025') return; // We already know they are in TFT 2025
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({r, c});
      const cell = ws[addr];
      if (!cell || cell.v === undefined) continue;
      
      const num = Number(cell.v);
      if (isNaN(num)) continue;
      
      targets.forEach(t => {
        // match positive or negative, within 1.0
        if (Math.abs(Math.abs(num) - Math.abs(t.val)) < 1.0) {
          console.log(`FOUND ${t.note} (${t.val}) in Sheet "${sheetName}" Cell ${addr}: ${cell.f ? '=' + cell.f + ' -> ' : ''}${cell.v}`);
          // also print adjacent text in column left or right
          const leftCell = ws[XLSX.utils.encode_cell({r, c: c - 1})];
          const rightCell = ws[XLSX.utils.encode_cell({r, c: c + 1})];
          const rowHeader = ws[XLSX.utils.encode_cell({r, c: 0})];
          console.log(`   Context: Col0=[${rowHeader?.v}], Left=[${leftCell?.v}], Right=[${rightCell?.v}]`);
        }
      });
    }
  }
});
