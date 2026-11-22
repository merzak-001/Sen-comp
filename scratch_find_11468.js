const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT doc_type, doc_number, account, counterparty_account, amount_local, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200')
      AND amount_local < 0
    ORDER BY doc_number
  `);

  for (const r of rows) {
    if (Math.abs(Math.abs(r.amount_local) - 11468.16) < 100) {
      console.log('FOUND EXACT 11468.16:', r);
    }
  }

  // Also check if any combination matches 11468.16
  for (const r of rows) {
    if (Math.abs(r.amount_local) < 20000 && !String(r.text_desc).includes('CHQ')) {
      console.log(`Small row: Doc ${r.doc_number} | Amt: ${r.amount_local} | Off: ${r.counterparty_account} | Txt: ${r.text_desc}`);
    }
  }
  process.exit(0);
})();
