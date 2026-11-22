const sql = require('./sqlDb');

async function checkDocs() {
  const docs = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account, posting_date
    FROM FBL3NLineItems
    WHERE doc_number IN ('1400007502', '1400007505')
  `);
  console.log('Docs 1400007502 & 1400007505:', docs);

  process.exit(0);
}

checkDocs();
