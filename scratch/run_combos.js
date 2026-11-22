const combos = [
  {
    id: "COMBO 1 (Standard SCF with IRG Reclass & Full Personnel)",
    description: "IRG (3.03M) shifted from Taxes to Personnel; STC severance in Personnel; All suppliers in 402; All fees in 404",
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -27059991.03, // Paie (9.24M) + CNAS (4.53M) + STC (10.25M) + IRG (3.03M)
    r404: -103708.35,   // Pure bank fees + foreign wire comms + 2014 regule
    r405: -18649480.00, // G50 (21.68M) - IRG (3.03M)
    r407: 0
  },
  {
    id: "COMBO 2 (STC Severance in Extraordinary Row 407)",
    description: "Accountant isolates non-recurring severance payment (10.25M) into Row 407; Regular payroll in 403",
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -16808769.20, // Paie (9.24M) + CNAS (4.53M) + IRG (3.03M)
    r404: -103708.35,
    r405: -18649480.00,
    r407: -10251221.83  // STC Ardjane
  },
  {
    id: "COMBO 3 (Raw Cash Basis - No IRG Split)",
    description: "Full G50 check placed in Taxes; Paie + CNAS + STC in Personnel; Direct bank statement amounts",
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -24027611.03, // Paie (9.24M) + CNAS (4.53M) + STC (10.25M)
    r404: -103708.35,
    r405: -21681860.00, // Full G50 check
    r407: 0
  },
  {
    id: "COMBO 4 (Local Bank Fees Only in Row 404)",
    description: "Row 404 contains only domestic account fees (62020100: -11,573.61 DA); Foreign wire fees kept in 402",
    r401: 71268189.42,
    r402: -75050496.94, // Suppliers + foreign wire fees + 2014
    r403: -27059991.03,
    r404: -11573.61,    // Only account 26020100 bank fees
    r405: -18649480.00,
    r407: 0
  },
  {
    id: "COMBO 5 (Capex Retenue de Garantie in Row 410)",
    description: "ETP Rouba guarantee (-309.7k) placed in Capex Row 410; Client refund (-309.8k) netted in 401",
    r401: 70958435.42,  // 71.27M - 309,754.00 (Innova refund)
    r402: -74338906.83, // Pure commercial trade suppliers
    r403: -27059991.03,
    r404: -103708.35,
    r405: -18649480.00,
    r407: 0,
    r410: -309701.37    // ETP Rouba construction warranty
  },
  {
    id: "COMBO 6 (STC in Suppliers & No IRG Reclass)",
    description: "Accountant puts STC check with suppliers; keeps full G50 check in Row 405",
    r401: 71268189.42,
    r402: -85209584.03, // Suppliers + STC
    r403: -13776389.20, // Net Paie + CNAS only
    r404: -103708.35,
    r405: -21681860.00,
    r407: 0
  },
  {
    id: "COMBO 7 (Standard SCF with Pure Operational Bank Fees -62.6k)",
    description: "Standard IRG shift; Row 404 excludes 2014 régule (-41k shifted to 402)",
    r401: 71268189.42,
    r402: -74999428.06, // Suppliers + 2014 régule
    r403: -27059991.03,
    r404: -62642.49,    // Pure current bank fees & comms
    r405: -18649480.00,
    r407: 0
  }
];

combos.forEach(c => {
  const r406 = c.r401 + c.r402 + c.r403 + c.r404 + c.r405;
  const r408 = r406 + (c.r407 || 0);
  console.log(`\n========================================`);
  console.log(`${c.id}`);
  console.log(`Summary: ${c.description}`);
  console.log(`  Row 401 (Clients)     : ${c.r401.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 402 (Fournisseurs): ${c.r402.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 403 (Personnel)   : ${c.r403.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 404 (Frais banque): ${c.r404.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 405 (Impôts)      : ${c.r405.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  ----------------------------------------`);
  console.log(`  Row 406 (Sous-total)  : ${r406.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  if (c.r407) console.log(`  Row 407 (Extraord.)   : ${c.r407.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  console.log(`  Row 408 (Flux Op A)   : ${r408.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
  if (c.r410) console.log(`  Row 410 (Invest.)     : ${c.r410.toLocaleString('fr-FR', {minimumFractionDigits: 2})} DA`);
});
