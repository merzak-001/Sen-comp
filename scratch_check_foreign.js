const sql = require('./sqlDb');

async function testForeignPayments() {
  console.log('=== CHECKING PAYMENTS FROM OUTSIDE ALGERIA (14050500 / SENSUS FRANCE) ===\n');

  const rows = await sql.query(`
    SELECT fiscal_month, doc_number, doc_type, account, amount_local, text_desc, counterparty_account, posting_date
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND (
      account = '14050500'
      OR text_desc LIKE '%FRANCE%'
      OR text_desc LIKE '%SENSUS%'
      OR text_desc LIKE '%DEVIS%'
      OR counterparty_account = '14050500'
      OR counterparty_account = '38147'
    )
    ORDER BY fiscal_month, doc_number
  `);

  console.log(`Found ${rows.length} rows related to foreign / group clients:`);
  console.table(rows.map(r => ({
    M: r.fiscal_month,
    Doc: r.doc_number,
    Type: r.doc_type,
    Acct: r.account,
    Amt: Number(r.amount_local).toLocaleString('fr-FR'),
    Off: r.counterparty_account,
    Txt: r.text_desc
  })));

  process.exit(0);
}

testForeignPayments();
