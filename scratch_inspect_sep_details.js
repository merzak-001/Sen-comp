const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT doc_type, doc_number, account, counterparty_account, amount_local, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200')
      AND amount_local < 0
    ORDER BY doc_number
  `);

  console.log('--- ALL OUTFLOWS IN SEPTEMBER 2026 ---');
  for (const r of rows) {
    const txt = String(r.text_desc || '');
    const off = String(r.counterparty_account || '');
    if (txt.toLowerCase().includes('impot') || txt.toLowerCase().includes('paie') || txt.toLowerCase().includes('salaire') || txt.toLowerCase().includes('cnas') || txt.toLowerCase().includes('comm') || txt.toLowerCase().includes('frais') || off.startsWith('44') || off.startsWith('43') || off.startsWith('42') || off.startsWith('174') || off.startsWith('173')) {
      console.log(`Doc: ${r.doc_number} | Type: ${r.doc_type} | Off: ${off.padEnd(10)} | Amt: ${r.amount_local.toString().padStart(12)} | Txt: ${txt}`);
    }
  }
  process.exit(0);
})();
