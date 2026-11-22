const sql = require('./sqlDb');

async function testAllMonthsAccountantMethod() {
  console.log('=== APPLYING ACCOUNTANT METHOD ACROSS ALL MONTHS OF 2026 ===\n');

  // Client receivables accounts:
  // 14000010: Domestic customers (TVA 19%)
  // 14000030: ADE public utility (TVA 19%)
  // 14050500: Foreign / Group customers (TVA 0% - Exports!)
  // 14060016: Customer Advances

  // Sales accounts:
  // Domestic sales: 88010031, 88010039, 88010053 (TVA 19%)
  // Export sales: 88030510 (TVA 0% - Outside Algeria!)

  const q = await sql.query(`
    SELECT fiscal_month, account, doc_type, amount_local, doc_number, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account IN (
      '14000010', '14000030', '14050500', '14060016',
      '88010031', '88010039', '88010053', '88030510'
    )
    ORDER BY fiscal_month, doc_number
  `);

  // Initial balances at 01/01/2026 from balance 102026.xls
  let balDomesticADE = 20880897.29 + 236216347.00; // 257,097,244.29
  let balForeign = 25003795.52; // Sensus France / Outside Algeria
  let balAdvances = -3055742.13;

  const results = [];

  for (let m = 1; m <= 10; m++) {
    const mRows = q.filter(r => r.fiscal_month === m);

    // 1. Sales Domestic vs Export
    const domSalesRows = mRows.filter(r => ['88010031', '88010039', '88010053'].includes(r.account));
    const domSalesHT = domSalesRows.reduce((a, r) => a - Number(r.amount_local), 0);
    const domSalesTTC = domSalesHT * 1.19; // 19% TVA in Algeria

    const expSalesRows = mRows.filter(r => r.account === '88030510');
    const expSalesHT = expSalesRows.reduce((a, r) => a - Number(r.amount_local), 0);
    const expSalesTTC = expSalesHT * 1.00; // 0% TVA (Exportation exonérée)

    const totalSalesTTC = domSalesTTC + expSalesTTC;

    // 2. Receivables Variation Domestic+ADE
    const prevDomADE = balDomesticADE;
    const domADERows = mRows.filter(r => ['14000010', '14000030'].includes(r.account));
    const domADENet = domADERows.reduce((a, r) => a + Number(r.amount_local), 0);
    balDomesticADE += domADENet;
    const varDomADE = prevDomADE - balDomesticADE; // M-1 minus M

    // 3. Receivables Variation Foreign (Outside Algeria)
    const prevForeign = balForeign;
    const foreignRows = mRows.filter(r => r.account === '14050500');
    const foreignNet = foreignRows.reduce((a, r) => a + Number(r.amount_local), 0);
    balForeign += foreignNet;
    const varForeign = prevForeign - balForeign; // M-1 minus M

    // 4. Advances Variation (14060016)
    const prevAdv = balAdvances;
    const advRows = mRows.filter(r => r.account === '14060016');
    const advNet = advRows.reduce((a, r) => a + Number(r.amount_local), 0);
    balAdvances += advNet;
    const varAdvances = -advNet; // Net new cash advances received

    // Total 401 using Accountant SCF Formula:
    // 401 = CA TTC (Dom + Exp) + Var Creances (Dom + Exp) + Var Avances
    const scf401 = totalSalesTTC + varDomADE + varForeign + varAdvances;

    results.push({
      month: m,
      domSalesTTC,
      expSalesTTC,
      totalSalesTTC,
      varDomADE,
      varForeign,
      varAdvances,
      scf401
    });
  }

  const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre'];

  console.log('Mois      | CA Dom TTC   | CA Exp (0%)  | Var Créanc Dom | Var Créanc Exp | Var Avances  | 401 COMPTABLE (SCF)');
  console.log('---------------------------------------------------------------------------------------------------------------');
  for (const r of results) {
    const toM = v => (v / 1000000).toFixed(2).padStart(8) + ' M';
    console.log(
      `${MONTHS[r.month - 1].padEnd(10)}| ` +
      `${toM(r.domSalesTTC)} | ` +
      `${toM(r.expSalesTTC)} | ` +
      `${toM(r.varDomADE)} | ` +
      `${toM(r.varForeign)} | ` +
      `${toM(r.varAdvances)} | ` +
      `${toM(r.scf401)}`
    );
  }

  console.log('\n--- TARGET COMPARISON ---');
  console.log(`Août (Mois 8)      : SCF Computed = ${results[7].scf401.toLocaleString('fr-FR')} DA | Target = 348 430 299,60 DA`);
  console.log(`Septembre (Mois 9) : SCF Computed = ${results[8].scf401.toLocaleString('fr-FR')} DA | Target = 210 951 817,50 DA`);

  process.exit(0);
}

testAllMonthsAccountantMethod();
