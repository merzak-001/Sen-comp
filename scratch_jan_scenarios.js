const combinations = [
  {
    name: 'Scenario 1: Standard Reclassification (Same as May & Sept)',
    desc: 'Salary IRG (3.03M) moved from G50 to Personnel; STC severance included in Personnel',
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -27059991.03, // Paie (9.24M) + CNAS (4.53M) + STC (10.25M) + IRG (3.03M)
    r404: -103708.35,
    r405: -18649480.00, // G50 (21.68M) - IRG (3.03M)
    r407: 0
  },
  {
    name: 'Scenario 2: STC Severance Classified as Extraordinary (Row 407)',
    desc: 'The 10.25M STC departure check isolated in Row 407; Regular payroll in 403',
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -16808769.20, // Paie (9.24M) + CNAS (4.53M) + IRG (3.03M)
    r404: -103708.35,
    r405: -18649480.00,
    r407: -10251221.83  // STC Ardjane
  },
  {
    name: 'Scenario 3: No IRG Split (Raw Bank Checks)',
    desc: 'Full G50 check in Taxes; Net Paie + CNAS + STC in Personnel',
    r401: 71268189.42,
    r402: -74958362.20,
    r403: -24027611.03, // Paie (9.24M) + CNAS (4.53M) + STC (10.25M)
    r404: -103708.35,
    r405: -21681860.00, // Full G50 check
    r407: 0
  },
  {
    name: 'Scenario 4: Strict Operating Cash (TVA Only in 405 + Bank Fees excl 2014)',
    desc: 'Row 405 = Exact December TVA due (17,238,704.17); Bank fees = 62,642.49',
    r401: 71268189.42,
    r402: -76369138.03, // Suppliers + other taxes balance
    r403: -27059991.03,
    r404: -62642.49,
    r405: -17238704.17, // December TVA balance
    r407: 0
  },
  {
    name: 'Scenario 5: STC in Suppliers / General Outflows',
    desc: 'If accountant lumped STC check into general disbursements (Row 402)',
    r401: 71268189.42,
    r402: -85209584.03, // Suppliers + STC
    r403: -16808769.20, // Regular Paie + CNAS + IRG
    r404: -103708.35,
    r405: -18649480.00,
    r407: 0
  },
  {
    name: 'Scenario 6: Net Operating Disbursements Plug (Row 402 as Residual)',
    desc: 'Row 402 derived from Net Bank Operating Change (+71.27M In - 48.79M Net Var = 120.06M Out)',
    r401: 71268189.42,
    r402: -74251147.90, 
    r403: -27059991.03,
    r404: -103708.35,
    r405: -18649480.00,
    r407: 0
  }
];

console.log('=== JANUARY 2026 CANDIDATE SCENARIOS ===\n');
combinations.forEach((c, idx) => {
  const r406 = c.r401 + c.r402 + c.r403 + c.r404 + c.r405;
  const r408 = r406 + c.r407;
  console.log(`--- [SCENARIO ${idx+1}] ${c.name} ---`);
  console.log(`    ${c.desc}`);
  console.log(`    401 (Clients)     : ${c.r401.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    402 (Fournisseurs): ${c.r402.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    403 (Personnel)   : ${c.r403.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    404 (Frais banque): ${c.r404.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    405 (Impôts)      : ${c.r405.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    406 (Sous-total)  : ${r406.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  if (c.r407 !== 0) console.log(`    407 (Extraordinaire): ${c.r407.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
  console.log(`    408 (Flux Op A)   : ${r408.toLocaleString('en-US', {minimumFractionDigits: 2})}\n`);
});
