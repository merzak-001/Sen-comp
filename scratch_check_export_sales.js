const sql = require('./sqlDb');

async function checkExportSales() {
  const rows = await sql.query(`
    SELECT fiscal_month, doc_number, doc_type, account, amount_local, text_desc, counterparty_account, posting_date
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND account = '88030510'
    ORDER BY fiscal_month, doc_number
  `);
  console.log(`Found ${rows.length} rows for 88030510 (Export Sales):`);
  console.table(rows.map(r => ({
    M: r.fiscal_month,
    Doc: r.doc_number,
    Type: r.doc_type,
    Amt: Number(r.amount_local).toLocaleString(),
    Off: r.counterparty_account,
    Date: r.posting_date
  })));
  process.exit(0);
}

checkExportSales();
