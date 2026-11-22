const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const augOutflows = [];
for (let i = 1; i < data.length; i++) {
  const p = data[i][7];
  if (p === '2026/08') {
    const acct = String(data[i][2] || '');
    if (bankAccts.includes(acct)) {
      const amt = Number(data[i][14]) || 0;
      if (amt < 0) {
        augOutflows.push({
          doc: String(data[i][3]),
          acct,
          off: String(data[i][6]),
          amt: -amt, // positive magnitude
          txt: String(data[i][20] || '')
        });
      }
    }
  }
}

console.log('Total August bank outflows:', augOutflows.length);

// Also look at supplier accounts debits:
const suppAccts = ['16000010', '16010800', '17110102'];
const debits = [];
for (let i = 1; i < data.length; i++) {
  const p = data[i][7];
  if (p === '2026/08') {
    const acct = String(data[i][2] || '');
    const amt = Number(data[i][14]) || 0;
    if (suppAccts.includes(acct) && amt > 0) {
      debits.push({
        doc: String(data[i][3]),
        acct,
        off: String(data[i][6]),
        amt,
        txt: String(data[i][20] || '')
      });
    }
  }
}
console.log('Total August supplier debits:', debits.length);

// Let's test combinations of bank outflows that sum to 70885xxx:
// Or combinations of debits that sum to 70885xxx:
console.log('\n--- Searching Debits for 70 885 xxx ---');
// Debits pool: 54 items.
// Convert to integer cents:
const debCents = debits.map(d => ({ ...d, cents: Math.round(d.amt * 100) }));
const targetMinCents = 7088500000;
const targetMaxCents = 7088599999;

// In debits, total sum is 87,657,835.01 (8,765,783,501 cents)
const totalDebCents = debCents.reduce((s, d) => s + d.cents, 0);
const needExclMin = totalDebCents - targetMaxCents; // 1,677,183,502
const needExclMax = totalDebCents - targetMinCents; // 1,677,283,501

console.log('Need exclusion in debits between: ' + (needExclMin/100).toFixed(2) + ' and ' + (needExclMax/100).toFixed(2));

// Sort descending
debCents.sort((a,b) => b.cents - a.cents);

const debMatches = [];
function searchDeb(idx, curCents, path) {
  if (curCents >= needExclMin && curCents <= needExclMax) {
    debMatches.push({ net: (totalDebCents - curCents) / 100, path: [...path] });
    return;
  }
  if (curCents > needExclMax || idx >= debCents.length) return;

  for (let i = idx; i < debCents.length; i++) {
    if (curCents + debCents[i].cents > needExclMax) continue;
    path.push(debCents[i]);
    searchDeb(i + 1, curCents + debCents[i].cents, path);
    path.pop();
  }
}

searchDeb(0, 0, []);
console.log('Debit matches found: ' + debMatches.length);
debMatches.forEach(m => {
  console.log('=> MATCH ROW 402 FROM DEBITS: ' + m.net.toFixed(2));
  m.path.forEach(p => console.log(`   - ${p.doc}: ${p.amt.toFixed(2)} (${p.acct}->${p.off})`));
});
