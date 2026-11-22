const fs = require('fs');
const { execSync } = require('child_process');

const out = execSync('node scratch_find_exact_subset_all_months.js').toString();
const lines = out.split('\n');

const accountCounts = {};
const accountSums = {};

for (const line of lines) {
  const m = line.match(/\+\s+(\d+)\s+\(([^)]+)\)\s*:\s*([\d\s,.]+)\s*DA/);
  if (m) {
    const acc = m[1];
    const desc = m[2].trim();
    const val = parseFloat(m[3].replace(/\s/g, '').replace(',', '.'));
    
    if (!accountCounts[acc]) {
      accountCounts[acc] = { count: 0, desc, total: 0 };
    }
    accountCounts[acc].count++;
    accountCounts[acc].total += val;
  }
}

console.log('=== FREQUENCY AND TOTAL OF ACCOUNTS ACROSS ALL 12 MONTHS ===');
const sorted = Object.entries(accountCounts).sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total);
for (const [acc, data] of sorted) {
  console.log(`${acc.padEnd(10)} | ${data.desc.padEnd(25)} | Months: ${String(data.count).padStart(2)}/12 | Total: ${data.total.toLocaleString('fr-FR', {minimumFractionDigits: 2}).padStart(16)} DA`);
}
