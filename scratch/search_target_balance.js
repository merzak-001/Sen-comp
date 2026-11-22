const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const target = 210951817.50;
console.log('Searching for target', target, 'in balance 102026.xls...');

const allNums = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  for (let c = 0; c < r.length; c++) {
    const v = r[c];
    if (typeof v === 'number') {
      allNums.push({ row: i, col: c, val: v, rDesc: r[4] || r[3] || r[2] });
      if (Math.abs(v - target) < 10) {
        console.log('DIRECT MATCH:', i, c, v, r);
      }
    }
  }
}

// Check differences: valA - valB = target
for (let i = 0; i < allNums.length; i++) {
  for (let j = 0; j < allNums.length; j++) {
    if (i === j) continue;
    const diff = allNums[i].val - allNums[j].val;
    if (Math.abs(diff - target) < 1) {
      console.log('DIFF MATCH:', allNums[i], 'minus', allNums[j], '=', diff);
    }
  }
}
