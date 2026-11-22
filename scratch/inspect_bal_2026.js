const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls';
const wb = XLSX.readFile(path);
console.log('balance 102026.xls sheets:', wb.SheetNames);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('Row count:', rows.length);
console.log('Header sample:', rows.slice(0, 8));

// Find cash accounts (classe 5 / 51 / 53 / 54) in balance 102026
const c5 = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[1]) continue;
  const cpte = String(r[1]).trim();
  const desc = String(r[2] || '').trim();
  if (cpte.startsWith('5') || cpte.startsWith('1017') || cpte.startsWith('1186') || cpte.startsWith('1187') || desc.toLowerCase().includes('banque') || desc.toLowerCase().includes('caisse')) {
    c5.push({ rowIdx: i, cpte, desc, r4: r[4], r5: r[5], r6: r[6], r7: r[7], r8: r[8] });
  }
}
console.log('\nCash / Bank accounts in balance 102026.xls:');
console.table(c5);
