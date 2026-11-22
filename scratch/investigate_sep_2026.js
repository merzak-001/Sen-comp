const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

console.log('--- DETAILED INVESTIGATION FOR SEPTEMBER 2026 (MONTH 9) ---');

// Filter September lines (period 9 or posting date in 2026-09)
const sepLines = rows.filter(r => {
  const p = r['Période comptable'];
  const ym = r['Année/Mois'];
  const d = String(r['Date comptable'] || '');
  return p === 9 || ym === '2026/09';
});
console.log(`Found ${sepLines.length} lines for September 2026.`);

// Group September lines by Doc Type and Account
const byDocType = {};
const byAccount = {};
for (const r of sepLines) {
  const dt = r['Type de pièce'] || 'UNKNOWN';
  const acc = String(r['Compte'] || '');
  const amt = r['Montant en devise interne'] || 0;
  byDocType[dt] = (byDocType[dt] || 0) + amt;
  byAccount[acc] = (byAccount[acc] || 0) + amt;
}

console.log('\nSeptember movements by Doc Type:');
for (const [dt, s] of Object.entries(byDocType)) {
  console.log(`  ${dt.padEnd(6)}: ${s.toLocaleString('fr-FR').padStart(20)} DA`);
}

// Check client accounts in September
// Accounts: 14000010, 14000030, 14050500, 14060016
console.log('\nClient accounts in September 2026:');
for (const acc of ['14000010', '14000030', '14050500', '14060016']) {
  const lines = sepLines.filter(r => String(r['Compte']) === acc);
  const deb = lines.filter(r => r['Montant en devise interne'] > 0).reduce((a, b) => a + b['Montant en devise interne'], 0);
  const cred = lines.filter(r => r['Montant en devise interne'] < 0).reduce((a, b) => a + b['Montant en devise interne'], 0);
  console.log(`  Compte ${acc.padEnd(10)}: Debit = ${deb.toLocaleString('fr-FR').padStart(16)} | Credit = ${cred.toLocaleString('fr-FR').padStart(16)} | Net = ${(deb + cred).toLocaleString('fr-FR').padStart(16)}`);
}

// Let's inspect all receipts from clients in September
const sepDZ = sepLines.filter(r => r['Type de pièce'] === 'DZ');
console.log(`\nDZ lines in September: ${sepDZ.length}`);
for (const r of sepDZ) {
  console.log(`  DZ Doc ${r['Nº pièce']} | Cpte: ${r['Compte']} | Amt: ${r['Montant en devise interne']} | Text: ${r['Texte']} | Off: ${r['Compte contrepartie']}`);
}
