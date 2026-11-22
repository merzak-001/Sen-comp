const sql = require('./sqlDb');

async function search() {
  const r = await sql.query(`
    SELECT fiscal_month, doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND (
      ABS(amount_local - 33353411.94) < 1000000
      OR ABS(ABS(amount_local) - 33353411.94) < 1000000
    )
  `);
  console.log('Matches for ~33.35M DA:', r);

  // Also check in general for any 348430299 in the whole database
  const r2 = await sql.query(`
    SELECT fiscal_year, fiscal_month, doc_number, doc_type, account, amount_local, text_desc
    FROM FBL3NLineItems
    WHERE ABS(ABS(amount_local) - 348430299.60) < 1000
  `);
  console.log('Direct matches for 348 430 299.60:', r2);

  process.exit(0);
}

search();
