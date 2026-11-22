const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const target402 = 58476977.38;
const target403 = 26964763.13;
const target404 = 75649.19;
const target405 = 18738627.00;
const target406 = 32987827.28;

console.log('=== EXACT MATCHING ANALYSIS FOR JAN 2026 ===');

// Check 405: G50 check was 21,681,860.00
const g50 = 21681860.00;
const diff405 = g50 - target405;
console.log(`405: G50 (${g50}) - 405 (${target405}) = ${diff405} (exact deduction from G50)`);

// Check 403:
// Net Paie: 9,242,025.36
// CNAS: 4,534,363.84
// STC: 10,251,221.83
// Sum base = 24,027,611.03
const base403 = 9242025.36 + 4534363.84 + 10251221.83;
const diff403 = target403 - base403;
console.log(`403: Target (${target403}) - Base (${base403}) = ${diff403}`);

console.log(`Compare 405 deduction (${diff405}) vs 403 addition (${diff403}): Difference = ${diff405 - diff403}`);

// Check 402:
// Total suppliers was 74,958,362.20
const totalSuppliers = 74958362.20;
const diff402 = totalSuppliers - target402;
console.log(`402: Total suppliers (${totalSuppliers}) - Target (${target402}) = ${diff402}`);

// Let's search all January rows for diff405 (2,943,233.00), diff403 (2,937,152.10), diff402 (16,481,384.82), target404 (75,649.19)
console.log('\nSearching for exact transactions or sub-totals in January:');
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    const amt = Math.abs(Number(data[i][14]) || 0);
    const doc = String(data[i][3]);
    const acct = String(data[i][2]);
    const txt = String(data[i][20] || '');
    if (Math.abs(amt - diff405) < 1) console.log(`MATCH diff405 (2.943M): Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
    if (Math.abs(amt - diff403) < 1) console.log(`MATCH diff403 (2.937M): Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
    if (Math.abs(amt - target404) < 1) console.log(`MATCH target404 (75.6k): Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
    if (Math.abs(amt - (diff405 - diff403)) < 1) console.log(`MATCH delta IRG (6080.90): Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
  }
}

// Let's search December 2025 rows for diff405 (2,943,233.00) or diff403 (2,937,152.10)
console.log('\nSearching in 2025/12 rows (since Jan G50 pays Dec taxes):');
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2025/12') {
    const amt = Math.abs(Number(data[i][14]) || 0);
    const doc = String(data[i][3]);
    const acct = String(data[i][2]);
    const txt = String(data[i][20] || '');
    if (Math.abs(amt - diff405) < 1) console.log(`MATCH in Dec 2025 diff405: Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
    if (Math.abs(amt - diff403) < 1) console.log(`MATCH in Dec 2025 diff403: Acct ${acct} Doc ${doc} Amt ${amt} Txt: ${txt}`);
  }
}
