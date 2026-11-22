const XLSX = require('xlsx');

const filePath = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx';
const wb = XLSX.readFile(filePath, { cellFormula: true });
const ws = wb.Sheets['BAL DEC'];

function printSection(title, startR, endR) {
  console.log(`\n=== ${title} (Rows ${startR} to ${endR}) ===`);
  for (let r = startR - 1; r <= endR - 1; r++) {
    let rowStr = [];
    for (let c = 0; c <= 15; c++) {
      const cell = ws[XLSX.utils.encode_cell({r, c})];
      if (cell && cell.v !== undefined && cell.v !== '') {
        const val = cell.f ? `=${cell.f} [${cell.v}]` : cell.v;
        rowStr.push(`C${c}: ${val}`);
      }
    }
    if (rowStr.length > 0) {
      console.log(`R${r+1}: ` + rowStr.join(' | '));
    }
  }
}

// 1. Cautions (Rows 50-60)
printSection('CAUTIONS (Note 412 / 413)', 50, 60);

// 2. Clients (Rows 150-165)
printSection('CLIENTS (Note 401)', 150, 168);

// 3. Forex / Liquidités (Rows 275-285)
printSection('CHANGE / DEVISES (Note 423)', 275, 285);

// 4. Frais Bancaires (Rows 375-395)
printSection('FRAIS BANCAIRES (Note 404)', 375, 395);
