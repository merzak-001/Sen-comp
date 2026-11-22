const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

const sepLines = rows.filter(r => r['Période comptable'] === 9 || r['Année/Mois'] === '2026/09');
const sepClients = sepLines.filter(r => ['14000010', '14000030', '14050500'].includes(String(r['Compte'])) && r['Montant en devise interne'] < 0);

console.log('List of September client credits (' + sepClients.length + ' lines):');
let runningTot = 0;
for (const r of sepClients) {
  const amt = Math.abs(r['Montant en devise interne']);
  runningTot += amt;
  console.log(r['Nº pièce'] + ' | Cpte:' + r['Compte'] + ' | Typ:' + r['Type de pièce'] + ' | Amt:' + amt.toLocaleString('fr-FR') + ' | Cum:' + runningTot.toLocaleString('fr-FR') + ' | Txt:' + r['Texte'] + ' | Off:' + r['Compte contrepartie']);
}

// Check subset sum algorithm to find exact subset matching 210951817.50
const target = 210951817.50;
const amts = sepClients.map(r => ({ doc: r['Nº pièce'], amt: Math.abs(r['Montant en devise interne']), off: r['Compte contrepartie'] }));

// Total is 218 197 157.10
// We need to find elements that sum to total - target = 7 245 339.60
const diff = 218197157.10 - target;
console.log('\nLooking for items summing to diff:', diff.toFixed(2));
for (let i = 0; i < amts.length; i++) {
  if (Math.abs(amts[i].amt - diff) < 0.1) console.log('Match single:', amts[i]);
  for (let j = i + 1; j < amts.length; j++) {
    if (Math.abs(amts[i].amt + amts[j].amt - diff) < 0.1) console.log('Match pair:', amts[i], amts[j]);
    for (let k = j + 1; k < amts.length; k++) {
      if (Math.abs(amts[i].amt + amts[j].amt + amts[k].amt - diff) < 0.1) console.log('Match triple:', amts[i], amts[j], amts[k]);
    }
  }
}
