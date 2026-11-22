const sql = require('./sqlDb');

async function inspectMayJulyOct() {
  console.log('=== INSPECTING MAY, JULY, OCTOBER IN DETAIL ===\n');

  // Let's inspect all sales, receivables, advances, and foreign documents for May (month 5), July (month 7), and October (month 10)
  for (const m of [5, 7, 10]) {
    console.log(`====================== MONTH ${m} ======================`);
    
    // 1. Sales rows
    const sales = await sql.query(`
      SELECT account, doc_number, doc_type, amount_local, text_desc
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account IN ('88010031', '88010039', '88010053', '88030510')
    `);
    console.log(`Sales rows (count: ${sales.length}):`);
    console.table(sales.map(s => ({ doc: s.doc_number, type: s.doc_type, acct: s.account, amt: Number(s.amount_local).toLocaleString(), txt: s.text_desc })));

    // 2. Receivables movements (14000010, 14000030, 14050500)
    const rec = await sql.query(`
      SELECT account, doc_number, doc_type, amount_local, text_desc, counterparty_account
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account IN ('14000010', '14000030', '14050500')
    `);
    console.log(`Receivables rows (count: ${rec.length}):`);
    const sumRecDebit = rec.filter(r => r.amount_local > 0).reduce((a,b) => a + Number(b.amount_local), 0);
    const sumRecCredit = rec.filter(r => r.amount_local < 0).reduce((a,b) => a - Number(b.amount_local), 0);
    console.log(`  Debits (invoices/adjustments): ${sumRecDebit.toLocaleString()} DA`);
    console.log(`  Credits (collections/clearings): ${sumRecCredit.toLocaleString()} DA`);
    console.log(`  Net Receivables movement: ${(sumRecDebit - sumRecCredit).toLocaleString()} DA`);

    // 3. Advances movements (14060016)
    const adv = await sql.query(`
      SELECT doc_number, doc_type, amount_local, text_desc, counterparty_account
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m} AND account = '14060016'
    `);
    console.log(`Advance rows (count: ${adv.length}):`);
    console.table(adv.map(a => ({ doc: a.doc_number, type: a.doc_type, amt: Number(a.amount_local).toLocaleString(), txt: a.text_desc, off: a.counterparty_account })));

    // 4. Foreign client / Sensus France transactions
    const foreign = await sql.query(`
      SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
      FROM FBL3NLineItems
      WHERE fiscal_year = 2026 AND fiscal_month = ${m}
        AND (
          counterparty_account = '38147'
          OR text_desc LIKE '%SENSUS FRANCE%'
          OR text_desc LIKE '%DEVIS SENSUS%'
        )
    `);
    console.log(`Foreign Sensus France rows (count: ${foreign.length}):`);
    console.table(foreign.map(f => ({ doc: f.doc_number, type: f.doc_type, acct: f.account, amt: Number(f.amount_local).toLocaleString(), txt: f.text_desc, off: f.counterparty_account })));
    console.log('\n');
  }

  process.exit(0);
}

inspectMayJulyOct();
