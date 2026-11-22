const XLSX = require('xlsx');
const path = 'C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx';
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets['Feuil1']);

const target = 210951817.50;
console.log('Target to find:', target);

const sepLines = rows.filter(r => r['Période comptable'] === 9 || r['Année/Mois'] === '2026/09');

// 1. Check sum of all DZ debits on bank accounts:
const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const sepBankDZ = sepLines.filter(r => bankAccounts.includes(String(r['Compte'])) && r['Type de pièce'] === 'DZ');
const sumBankDZ = sepBankDZ.reduce((a, b) => a + (b['Montant en devise interne'] || 0), 0);
console.log('Total Bank DZ in September:', sumBankDZ);

// 2. Total credits on client accounts in September
const sepClientCred = sepLines.filter(r => ['14000010', '14000030', '14050500'].includes(String(r['Compte'])) && r['Montant en devise interne'] < 0);
const sumClientCred = sepClientCred.reduce((a, b) => a + Math.abs(b['Montant en devise interne'] || 0), 0);
console.log('Total Client Credits in September:', sumClientCred);

// 3. Check bank by bank in September:
for (const acc of bankAccounts) {
  const bLines = sepBankDZ.filter(r => String(r['Compte']) === acc);
  const s = bLines.reduce((a, b) => a + b['Montant en devise interne'], 0);
  if (s > 0) console.log(`  Bank ${acc} DZ in Sep: ${s.toLocaleString('fr-FR')} DA`);
}

// 4. Check client by client:
for (const acc of ['14000010', '14000030', '14050500']) {
  const cLines = sepClientCred.filter(r => String(r['Compte']) === acc);
  const s = cLines.reduce((a, b) => a + Math.abs(b['Montant en devise interne']), 0);
  console.log(`  Client account ${acc} credit in Sep: ${s.toLocaleString('fr-FR')} DA`);
}

// Check difference
console.log('\nDifferences with Target:');
console.log('Bank DZ - Target:', (sumBankDZ - target));
console.log('Client Credits - Target:', (sumClientCred - target));
