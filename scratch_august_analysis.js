const sql = require('./sqlDb');

async function analyzeAugust() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  
  // 1. All positive bank lines in Month 8
  const bankRows = await sql.query(`
    SELECT doc_type, account, amount_local, text_desc, counterparty_account, doc_number, posting_date, doc_date
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
    ORDER BY doc_number
  `);

  console.log(`--- TOTAL BANK ROWS IN AUG 2026: ${bankRows.length} ---`);
  
  // Non-internal
  const nonInternal = bankRows.filter(r => !(bankAccounts.includes(r.counterparty_account) && r.doc_type !== 'DZ'));
  const positive = nonInternal.filter(r => r.amount_local > 0);
  const sumPos = positive.reduce((a, b) => a + Number(b.amount_local), 0);
  console.log(`Sum of all positive bank lines (non-internal): ${sumPos.toLocaleString('fr-FR')} DA`);

  const targetAug = 348430299.60;
  console.log(`Target Accountant Aug 401: ${targetAug.toLocaleString('fr-FR')} DA`);
  console.log(`Difference (sumPos - targetAug): ${(sumPos - targetAug).toLocaleString('fr-FR')} DA`);

  // Breakdown by doc_type
  const byDt = {};
  for (const r of positive) {
    byDt[r.doc_type] = (byDt[r.doc_type] || 0) + Number(r.amount_local);
  }
  console.log('Positive by doc_type:', byDt);

  // Print all positive items
  console.log('\n--- ALL POSITIVE BANK ITEMS IN AUG 2026 ---');
  for (const r of positive) {
    console.log(`Doc: ${r.doc_number} | DT: ${r.doc_type} | Amt: ${Number(r.amount_local).toLocaleString('fr-FR')} | Off: ${r.counterparty_account} | Txt: ${r.text_desc}`);
  }

  process.exit(0);
}

analyzeAugust();
