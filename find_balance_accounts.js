const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/balance 102026.xls');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== FINDING KEY ACCOUNTS IN balance 102026.xls ===');

const keyAccts = ['17110102', '14000010', '14000030', '14060016', '15200003', '16000010', '17300228', '17760022', '17460003', '17470126', '26020100', '44010110', '44010114', '11867005', '11867009', '11867311', '11867010'];

rows.forEach((r, idx) => {
  if (!r) return;
  const acct = String(r[3] || '').trim();
  const desc = String(r[5] || '').trim();
  if (keyAccts.includes(acct) || acct.startsWith('1400') || acct.startsWith('1711') || acct.startsWith('2602') || acct.startsWith('4401')) {
    const report = r[9];
    const prev = r[11];
    const debit = r[13];
    const credit = r[15];
    const cum = r[16];
    console.log(`Row ${idx+1}: Acct:${acct.padEnd(10)} | Desc:${desc.padEnd(25)} | Report:${report} | Prev:${prev} | Debit:${debit} | Credit:${credit} | Cum:${cum}`);
  }
});
