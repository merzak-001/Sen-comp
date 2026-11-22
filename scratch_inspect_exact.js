const sql = require('./sqlDb');

async function inspectExact() {
  const targetAug = 348430299.60;
  const targetSep = 210951817.50;

  // Let's inspect all rows where doc_type IN ('DZ', 'ZP') with client accounts or bank accounts in Month 8
  const m8 = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account, posting_date
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8
      AND (account LIKE '11867%' OR account LIKE '140%')
    ORDER BY doc_number, amount_local DESC
  `);

  console.log(`Month 8 has ${m8.length} lines on bank/client accounts.`);

  // Let's group by doc_number in Month 8
  const docMap = {};
  for (const r of m8) {
    if (!docMap[r.doc_number]) docMap[r.doc_number] = [];
    docMap[r.doc_number].push(r);
  }

  // Let's sum client credits (amount_local < 0 on 140*) in month 8
  const clientCredits = m8.filter(r => r.account.startsWith('140') && r.amount_local < 0);
  const sumCredits = clientCredits.reduce((a, b) => a - Number(b.amount_local), 0);
  console.log('Total client credits in Month 8 on 14000010, 14000030, 14050500, 14060016:');
  console.log('Sum Credits:', sumCredits);
  console.log('Target Aug:', targetAug);
  console.log('Diff (SumCredits - Target):', sumCredits - targetAug);

  // Group client credits by account
  const advLines = await sql.query(`
    SELECT doc_number, doc_type, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account = '14060016'
    ORDER BY amount_local
  `);
  console.log('All lines on 14060016 in Month 8:');
  console.table(advLines);
  const sumAdv = advLines.reduce((a,b) => a + Number(b.amount_local), 0);
  console.log('Net variation on 14060016 in Month 8:', sumAdv);


  process.exit(0);
}

inspectExact();
