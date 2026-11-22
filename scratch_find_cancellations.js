const XLSX = require('xlsx');

// Load FBL3N 051026.xlsx
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('--- SEARCHING FOR CANCELLATIONS IN 2026 ---');
const cancellations2026 = [];

for (let i = 1; i < data.length; i++) {
  const period = String(data[i][7] || '');
  if (!period.startsWith('2026/')) continue;
  const txt = String(data[i][20] || '').toLowerCase();
  const amt = Number(data[i][14]) || 0;
  const acct = String(data[i][2]);
  const doc = String(data[i][3]);
  const off = String(data[i][6]);
  const dt = String(data[i][9]);

  if (txt.includes('annul') || txt.includes('rejet') || txt.includes('impay') || txt.includes('extourne') || txt.includes('storno') || txt.includes('annulation')) {
    cancellations2026.push({ period, acct, doc, off, dt, amt, txt: data[i][20] });
  }
}

console.log(`Found ${cancellations2026.length} cancellation entries in 2026:`);
cancellations2026.forEach(c => {
  console.log(`${c.period} | Doc: ${c.doc} | Acct: ${c.acct.padEnd(10)} | Off: ${c.off.padEnd(10)} | Type: ${c.dt} | Amt: ${c.amt.toString().padStart(12)} | Txt: ${c.txt}`);
});
