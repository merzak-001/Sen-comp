const suppliers = [
  { id: 'MOBILIS', name: 'ATM MOBILIS', amt: 16699.78 },
  { id: 'FLASH', name: 'FLASH GRAPHIC', amt: 15232.00 },
  { id: 'CNRC', name: 'CNRC', amt: 36000.00 },
  { id: 'CMA1', name: 'CMA CGM (Doc 2790)', amt: 322822.21 },
  { id: 'BAYDIAB', name: 'HOTEL BAY DIAB', amt: 129200.00 },
  { id: 'CMA2', name: 'CMA CGM (Doc 2792)', amt: 666796.15 },
  { id: 'PROMBATI', name: 'SPA PROMBATI HOTEL', amt: 154800.00 },
  { id: 'JOSTAR1', name: 'JOSTAR (Doc 9210)', amt: 6484177.47 },
  { id: 'JOSTAR2', name: 'JOSTAR (Doc 9211)', amt: 2976768.10 },
  { id: 'CAAT1', name: 'CAAT SETIF', amt: 31202.25 },
  { id: 'CAAT2', name: 'CAAT 304', amt: 375098.16 },
  { id: 'SLR1', name: 'SARL SLR (Doc 9214)', amt: 23522432.50 },
  { id: 'SLR2', name: 'SARL SLR (Doc 9215)', amt: 7520205.00 },
  { id: 'SENSUS1', name: 'SENSUS FRANCE (Doc 9217)', amt: 7789263.94 },
  { id: 'FRANCAR', name: 'FRANCAR', amt: 8064608.36 },
  { id: 'SENSUS2', name: 'SENSUS FRANCE (Doc 9219)', amt: 2591369.91 },
  { id: 'ROUBA', name: 'ETP ROUBA (Retenue garantie)', amt: 309701.37 },
  { id: 'PORT', name: 'RPD ALGER PORT', amt: 13642231.00 },
  { id: 'INNOVA', name: 'INNOVA REA', amt: 309754.00 }
];

const totalSuppliersAmt = suppliers.reduce((s, r) => s + r.amt, 0); // 74,958,362.20
const r401 = 71268189.42;

const p403 = [
  { desc: 'Paie + CNAS + STC + IRG', val: -27059991.03 },
  { desc: 'Paie + CNAS + STC (No IRG)', val: -24027611.03 }
];
const p404 = [
  { desc: 'Pure bank fees (-62.6k)', val: -62642.49 },
  { desc: 'Foreign wire comms (-51.1k)', val: -51068.88 }
];
const p405 = [
  { desc: 'G50 - IRG (-18.65M)', val: -18649480.00 }
];

const results = [];

function check(excludedList) {
  const exclSum = excludedList.reduce((s, x) => s + x.amt, 0);
  const r402 = -(totalSuppliersAmt - exclSum);
  if (r402 < -60000000 || r402 > -50000000) return;

  for (const c3 of p403) {
    for (const c4 of p404) {
      for (const c5 of p405) {
        const r406 = r401 + r402 + c3.val + c4.val + c5.val;
        if (r406 <= -30000000 && r406 >= -35000000) {
          results.push({
            excluded: excludedList.map(x => x.name),
            exclSum,
            r402,
            r403: c3.val,
            desc403: c3.desc,
            r404: c4.val,
            r405: c5.val,
            r406
          });
        }
      }
    }
  }
}

for (let i = 0; i < suppliers.length; i++) {
  check([suppliers[i]]);
  for (let j = i + 1; j < suppliers.length; j++) {
    check([suppliers[i], suppliers[j]]);
    for (let k = j + 1; k < suppliers.length; k++) {
      check([suppliers[i], suppliers[j], suppliers[k]]);
    }
  }
}

console.log(`Total clean combinations found: ${results.length}`);
results.sort((a,b) => b.r402 - a.r402); // sort by 402

// Filter unique 402 values
const unique402 = new Map();
for (const r of results) {
  const key = r.r402.toFixed(2) + '_' + r.r403.toFixed(2);
  if (!unique402.has(key)) {
    unique402.set(key, r);
  }
}

console.log(`Unique scenarios: ${unique402.size}`);
for (const r of unique402.values()) {
  console.log(`---`);
  console.log(`EXCLUDED: ${r.excluded.join(' + ')} (Sum = ${r.exclSum.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA)`);
  console.log(`  Row 402: ${r.r402.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 403: ${r.r403.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA (${r.desc403})`);
  console.log(`  Row 404: ${r.r404.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 405: ${r.r405.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 406: ${r.r406.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
}
