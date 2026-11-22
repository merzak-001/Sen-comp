const sql = require('./sqlDb');

async function check14050500() {
  console.log('=== CHECKING ACCOUNT 14050500 (CLIENTS GROUPE / EXPORT) IN ALL MONTHS ===\n');

  const rows = await sql.query(`
    SELECT fiscal_month, doc_number, doc_type, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account = '14050500'
    ORDER BY fiscal_month, doc_number
  `);

  console.log(`Total rows on 14050500: ${rows.length}`);
  console.table(rows.map(r => ({
    M: r.fiscal_month,
    Doc: r.doc_number,
    Type: r.doc_type,
    Amt: Number(r.amount_local).toLocaleString('fr-FR'),
    Off: r.counterparty_account,
    Txt: r.text_desc
  })));

  process.exit(0);
}

check14050500();
