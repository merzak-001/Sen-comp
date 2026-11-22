const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

console.log('Total rows in FBL3N:', rows.length);

// Filter for 2026/09
const sepRows = rows.filter(r => String(r['Année/Mois'] || '').trim() === '2026/09');
console.log('September 2026 rows:', sepRows.length);

// Group by Account and Counterpart
const byAccount = {};
sepRows.forEach(r => {
  const acct = String(r['Compte'] || 'UNKNOWN').trim();
  const docType = String(r['Type de pièce'] || '').trim();
  const debit = Number(r['Débit']) || 0;
  const credit = Number(r['Crédit']) || 0;
  const amt = Number(r['Montant en devise interne']) || (debit - credit);
  
  if (!byAccount[acct]) byAccount[acct] = { debit: 0, credit: 0, net: 0, count: 0, types: {} };
  byAccount[acct].debit += debit;
  byAccount[acct].credit += credit;
  byAccount[acct].net += amt;
  byAccount[acct].count++;
  byAccount[acct].types[docType] = (byAccount[acct].types[docType] || 0) + 1;
});

console.log('\n--- SEPTEMBER 2026 BY ACCOUNT ---');
Object.keys(byAccount).sort().forEach(acct => {
  const a = byAccount[acct];
  console.log(`${acct.padEnd(12)} | Count: ${String(a.count).padStart(4)} | Debit: ${a.debit.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} | Credit: ${a.credit.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} | Types: ${JSON.stringify(a.types)}`);
});
