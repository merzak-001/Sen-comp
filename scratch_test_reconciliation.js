const sql = require('./sqlDb');

async function testReconciliation() {
  const targetAug = 348430299.60;
  console.log(`Target Accountant August: ${targetAug.toLocaleString('fr-FR')} DA\n`);

  // Let's test different combinations of Bank receipts vs Client account credits
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  
  // All bank debits (cash inflows) in Month 8
  const bankDebits = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
      AND amount_local > 0
  `);

  // Filter out internal bank-to-bank transfers
  const nonInternalBank = bankDebits.filter(r => !bankAccounts.includes(r.counterparty_account));
  
  // Non-commercial bank inflows
  // Doc 100028948: Change euro 751,331.05 (423)
  // Doc 2000003376: Caution SEAAL 13,414,593.92 (413)
  // Doc 2000003402: CNAS cancel 3,567,178.07 (403)
  // Doc 2000003391: Hotel Mariot 46,268.00 (402)
  // Doc 2000003431: CAAT 76,400.00 (402/Divers)
  const nonCommercial = ['100028948', '2000003376', '2000003402', '2000003391', '2000003431'];
  const commercialBank = nonInternalBank.filter(r => !nonCommercial.includes(r.doc_number));

  console.log('Commercial Bank Inflows count:', commercialBank.length);
  const sumCommercialBank = commercialBank.reduce((a, b) => a + Number(b.amount_local), 0);
  console.log('Total Commercial Bank Inflows:', sumCommercialBank.toLocaleString('fr-FR'), 'DA');
  console.log('Difference with target (Bank - Target):', (sumCommercialBank - targetAug).toLocaleString('fr-FR'), 'DA');

  // Let's check which item in commercial bank inflows is 9,490,138.06 DA
  // Or check if a specific client doc was excluded!
  console.log('\nDifference to explain:', sumCommercialBank - targetAug);

  // Let's test combinations of 1 to 3 items in commercialBank that equal this difference
  const diff = sumCommercialBank - targetAug;
  for (const r of commercialBank) {
    if (Math.abs(r.amount_local - diff) < 1) console.log('EXACT 1-DOC EXCLUSION:', r);
  }
  for (let i = 0; i < commercialBank.length; i++) {
    for (let j = i + 1; j < commercialBank.length; j++) {
      if (Math.abs(commercialBank[i].amount_local + commercialBank[j].amount_local - diff) < 1) {
        console.log('EXACT 2-DOC EXCLUSION:', commercialBank[i], commercialBank[j]);
      }
    }
  }

  process.exit(0);
}

testReconciliation();
