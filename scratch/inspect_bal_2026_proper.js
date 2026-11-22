const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls';
const wb = XLSX.readFile(path);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('Finding accounts in balance 102026.xls...');
const accounts = [];
for (let i = 4; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;
  // Let's find account code in the row
  for (let c = 0; c < r.length; c++) {
    const val = String(r[c] || '').trim();
    if (/^\d{6,10}$/.test(val)) {
      const ste = r[c - 1];
      const desc = r[c + 2] || r[c + 1] || '';
      // find report and solde cum
      const nums = r.filter(x => typeof x === 'number');
      accounts.push({ rowIdx: i, cpte: val, desc: String(desc).trim(), nums });
      break;
    }
  }
}
console.log(`Found ${accounts.length} accounts.`);
const cash = accounts.filter(a => a.cpte.startsWith('5') || a.cpte.startsWith('1017') || a.cpte.startsWith('1186') || a.cpte.startsWith('1187') || a.desc.toLowerCase().includes('banque') || a.desc.toLowerCase().includes('caisse'));
console.log('Cash / Treasury accounts:');
for (const a of cash) {
  console.log(a.cpte.padEnd(12), a.desc.slice(0, 30).padEnd(30), a.nums);
}
