const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
const internalDocs = ['2000002796', '2000002774', '2000002775', '2000002776', '2000002780', '2000002786', '2000002797', '2000002811', '2000002812', '2000002813', '2000002799', '2000002800'];

const janRows = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][7] === '2026/01') {
    const acct = String(data[i][2]);
    const doc = String(data[i][3]);
    if (bankAccts.includes(acct) && !internalDocs.includes(doc)) {
      janRows.push({
        acct,
        doc,
        amt: Number(data[i][14]) || 0,
        txt: String(data[i][20] || '')
      });
    }
  }
}

// Fixed hints from user:
// 403: between 24m and 28m -> We know exactly:
// Net Paie (-9.24M) + CNAS (-4.53M) + STC (-10.25M) + Salary IRG (-3.03M) = -27,059,991.03 DA!
// Or without IRG: -24,027,611.03 DA!
// 404: between 50k and 80k -> Pure bank fees & foreign commissions = -62,642.49 DA!
// 405: between 15m and 20m -> G50 (-21.68M) - Salary IRG (-3.03M) = -18,649,480.00 DA!
// 401: 71,268,189.42 DA

const candidate403 = [-27059991.03, -24027611.03];
const candidate404 = [-62642.49];
const candidate405 = [-18649480.00];
const r401 = 71268189.42;

// All 19 supplier items:
const suppliers = [
  { name: 'ATM MOBILIS', amt: 16699.78 },
  { name: 'FLASH GRAPHIC', amt: 15232.00 },
  { name: 'CNRC', amt: 36000.00 },
  { name: 'CMA CGM (Doc 2790)', amt: 322822.21 },
  { name: 'HOTEL BAY DIAB', amt: 129200.00 },
  { name: 'CMA CGM (Doc 2792)', amt: 666796.15 },
  { name: 'PROMBATI HOTEL', amt: 154800.00 },
  { name: 'JOSTAR (Doc 9210)', amt: 6484177.47 },
  { name: 'JOSTAR (Doc 9211)', amt: 2976768.10 },
  { name: 'CAAT SETIF', amt: 31202.25 },
  { name: 'CAAT 304', amt: 375098.16 },
  { name: 'SARL SLR (Doc 9214)', amt: 23522432.50 },
  { name: 'SARL SLR (Doc 9215)', amt: 7520205.00 },
  { name: 'SENSUS FRANCE (Doc 9217)', amt: 7789263.94 },
  { name: 'FRANCAR', amt: 8064608.36 },
  { name: 'SENSUS FRANCE (Doc 9219)', amt: 2591369.91 },
  { name: 'ETP ROUBA (Retenue garantie)', amt: 309701.37 },
  { name: 'RPD ALGER PORT', amt: 13642231.00 },
  { name: 'INNOVA REA', amt: 309754.00 }
];

const totalSuppliersAmt = suppliers.reduce((s, r) => s + r.amt, 0); // 74,958,362.20

// We want logical accounting groupings for the excluded ~15M - 20M:
// Logical candidates to exclude from 402:
// Group A: Port d'Alger (13.64M) -> custom/transit duties (Row 405 or Row 410 or Row 402?)
// Group B: Sensus France (10.38M) -> Intercompany
// Group C: ETP Rouba (309.7k) -> Capex (Row 410)
// Group D: Jostar (9.46M) or Francar (8.06M)
// Group E: SLR 7.52M (Doc 9215) -> Capex or stock?

const logicalScenarios = [];

// 1. Alger Port + Sensus France small (13.64M + 2.59M = 16.23M)
logicalScenarios.push({
  name: 'Exclude Alger Port (13.64M) + Sensus France Doc 9219 (2.59M)',
  excluded: ['RPD ALGER PORT', 'SENSUS FRANCE (Doc 9219)'],
});

// 2. Alger Port + CAAT (insurance) + ETP Rouba (Retenue garantie) + Innova
logicalScenarios.push({
  name: 'Exclude Alger Port (13.64M) + CAAT Insurances (406k) + Retenue Garantie (309k) + Innova (309k)',
  excluded: ['RPD ALGER PORT', 'CAAT SETIF', 'CAAT 304', 'ETP ROUBA (Retenue garantie)', 'INNOVA REA'],
});

// 3. Sensus France both docs (7.79M + 2.59M = 10.38M) + Francar (8.06M) = 18.44M (All European foreign wire transfers!)
logicalScenarios.push({
  name: 'Exclude European Foreign Wire Transfers (Sensus France 10.38M + Francar 8.06M = 18.44M)',
  excluded: ['SENSUS FRANCE (Doc 9217)', 'SENSUS FRANCE (Doc 9219)', 'FRANCAR'],
});

// 4. Sensus France both docs (10.38M) + Jostar both docs (9.46M) = 19.84M (Sensus Fr + Jostar)
logicalScenarios.push({
  name: 'Exclude Sensus France (10.38M) + Jostar (9.46M) = 19.84M',
  excluded: ['SENSUS FRANCE (Doc 9217)', 'SENSUS FRANCE (Doc 9219)', 'JOSTAR (Doc 9210)', 'JOSTAR (Doc 9211)'],
});

// 5. Alger Port (13.64M) + Jostar small (2.98M) = 16.62M
logicalScenarios.push({
  name: 'Exclude Alger Port (13.64M) + Jostar Doc 9211 (2.98M)',
  excluded: ['RPD ALGER PORT', 'JOSTAR (Doc 9211)'],
});

// 6. Alger Port alone (13.64M) + ETP Rouba (309k) = 13.95M
logicalScenarios.push({
  name: 'Exclude Alger Port (13.64M) + ETP Rouba (309.7k)',
  excluded: ['RPD ALGER PORT', 'ETP ROUBA (Retenue garantie)'],
});

// 7. Sensus France Doc 9217 (7.79M) + Francar (8.06M) = 15.85M
logicalScenarios.push({
  name: 'Exclude Sensus France Doc 9217 (7.79M) + Francar (8.06M)',
  excluded: ['SENSUS FRANCE (Doc 9217)', 'FRANCAR'],
});

// 8. Jostar (9.46M) + Francar (8.06M) = 17.52M (All raw materials import suppliers)
logicalScenarios.push({
  name: 'Exclude Raw Materials Imports (Jostar 9.46M + Francar 8.06M = 17.52M)',
  excluded: ['JOSTAR (Doc 9210)', 'JOSTAR (Doc 9211)', 'FRANCAR'],
});

console.log('=== CANDIDATE CONFIGURATIONS MATCHING THE HINT ===\n');

for (const sc of logicalScenarios) {
  const exclAmt = suppliers.filter(s => sc.excluded.includes(s.name)).reduce((sum, s) => sum + s.amt, 0);
  const r402 = -(totalSuppliersAmt - exclAmt);
  for (const r403 of candidate403) {
    for (const r404 of candidate404) {
      for (const r405 of candidate405) {
        const r406 = r401 + r402 + r403 + r404 + r405;
        if (r402 <= -50000000 && r402 >= -60500000 && r406 <= -30000000 && r406 >= -35500000) {
          console.log(`Scenario: ${sc.name}`);
          console.log(`  Excluded items: ${sc.excluded.join(', ')} (Total = ${exclAmt.toFixed(2)})`);
          console.log(`  Row 401: ${r401.toFixed(2)}`);
          console.log(`  Row 402: ${r402.toFixed(2)}`);
          console.log(`  Row 403: ${r403.toFixed(2)}`);
          console.log(`  Row 404: ${r404.toFixed(2)}`);
          console.log(`  Row 405: ${r405.toFixed(2)}`);
          console.log(`  Row 406: ${r406.toFixed(2)}\n`);
        }
      }
    }
  }
}
