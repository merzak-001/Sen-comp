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

// Eliminate obvious internal bank transfers, payroll, taxes, bank fees, customer checks
const internalOffs = ['11867311', '11867005', '11867007', '11867009', '11867210', '11867211'];
const payrollDocs = ['2000003397', '2000003409', '2000003430', '2000003401', '2000003402', '2000003403'];
const taxDocs = ['2000003396'];
const bankFeeDocs = augOutflows.filter(r => ['44010110', '44010114', '26020100'].includes(r.off) || r.txt.includes('FRAIS') || r.txt.includes('COMM')).map(r => r.doc);
const dousDoc = '1400007499'; // 10.2M customer check

const candidates = augOutflows.filter(r => 
  !internalOffs.includes(r.off) &&
  !payrollDocs.includes(r.doc) &&
  !taxDocs.includes(r.doc) &&
  !bankFeeDocs.includes(r.doc) &&
  r.doc !== dousDoc
);

// Must-haves (top 6 commercial suppliers):
const mustHaves = ['1500009554', '1500009546', '1500009552', '1500009553', '1500009550', '1500009551', '1500009549'];
const mustSum = candidates.filter(r => mustHaves.includes(r.doc)).reduce((s, r) => s + r.amt, 0);

const optional = candidates.filter(r => !mustHaves.includes(r.doc)).sort((a,b) => b.amt - a.amt);

const targetMin = 70000000;
const targetMax = 70999999;
const neededMin = targetMin - mustSum;
const neededMax = targetMax - mustSum;

console.log('Must-haves sum (Top 6 suppliers):', mustSum);
console.log('Needed optional sum between:', neededMin.toFixed(2), 'and', neededMax.toFixed(2));
console.log('Optional items sorted by magnitude:');
optional.forEach(o => console.log(`  ${o.doc}: ${o.amt.toFixed(2)} | ${o.off} | ${o.txt}`));

const results = [];
function search(idx, currentSum, chosen) {
  if (currentSum >= neededMin && currentSum <= neededMax) {
    results.push({ sum: mustSum + currentSum, chosen: [...chosen] });
  }
  if (idx >= optional.length) return;

  // Pruning: if currentSum + sum of all remaining < neededMin, return
  // If currentSum > neededMax, return
  if (currentSum > neededMax) return;

  for (let i = idx; i < optional.length; i++) {
    if (currentSum + optional[i].amt > neededMax) continue;
    chosen.push(optional[i]);
    search(i + 1, currentSum + optional[i].amt, chosen);
    chosen.pop();
  }
}

search(0, 0, []);
console.log('\nFound ' + results.length + ' matching combinations starting with 70,xxx,xxx:');
results.sort((a,b) => a.sum - b.sum).forEach((res, i) => {
  console.log(`\n--- Match #${i+1}: ${res.sum.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DZD ---`);
  console.log('Items included on top of base 66.17M:');
  res.chosen.forEach(c => console.log(`  + ${c.doc} (${c.amt.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DZD) - ${c.txt || c.off}`));
});
