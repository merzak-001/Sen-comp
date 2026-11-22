const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const janRows = [];
for (let i = 1; i < data.length; i++) {
  const p = data[i][7]; // Année/Mois
  if (p === '2026/01') {
    janRows.push(data[i]);
  }
}
console.log(`FBL3N 051026.xlsx has ${janRows.length} rows for 2026/01!`);

// Check sales, receivables, and bank accounts in January in the Excel file
const sales = janRows.filter(r => String(r[2]).startsWith('88'));
const rec = janRows.filter(r => String(r[2]).startsWith('140'));
const bank = janRows.filter(r => ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'].includes(String(r[2])));

console.log(`Sales rows in Jan: ${sales.length}`);
console.log(`Receivables rows in Jan: ${rec.length}`);
console.log(`Bank rows in Jan: ${bank.length}`);

// Sum sales in Jan
const salesHT = sales.reduce((acc, r) => acc - (Number(r[14]) || 0), 0);
console.log(`Sales HT in Jan 2026: ${salesHT.toLocaleString()} DA | TTC (19%): ${(salesHT * 1.19).toLocaleString()} DA`);

// Receivables in Jan
const recNet = rec.filter(r => String(r[2]) !== '14060016').reduce((acc, r) => acc + (Number(r[14]) || 0), 0);
console.log(`Net receivables movement in Jan 2026: ${recNet.toLocaleString()} DA`);

// Advances in Jan
const advNet = rec.filter(r => String(r[2]) === '14060016').reduce((acc, r) => acc + (Number(r[14]) || 0), 0);
console.log(`Net advances movement in Jan 2026: ${advNet.toLocaleString()} DA`);

// Bank customer collections in Jan
const bankPos = bank.filter(r => Number(r[14]) > 0);
console.log(`Positive bank collections in Jan: ${bankPos.reduce((a, r) => a + Number(r[14]), 0).toLocaleString()} DA`);
for (const r of bankPos) {
  console.log(`  Bank ${r[2]} | Doc: ${r[3]} | Type: ${r[9]} | Amt: ${Number(r[14]).toLocaleString()} | Txt: ${r[20]}`);
}

process.exit(0);
