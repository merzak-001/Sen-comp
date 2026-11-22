const sqlDb = require('./sqlDb');

(async () => {
  const rows = await sqlDb.query(`
    SELECT doc_type, doc_number, account, counterparty_account, amount_local, text_desc
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200')
      AND amount_local < 0
    ORDER BY doc_number
  `);

  console.log('--- ALL BANK OUTFLOWS IN SEP 2026 ---');
  const fees = rows.filter(r => {
    const txt = String(r.text_desc || '').toLowerCase();
    const off = String(r.counterparty_account || '');
    return txt.includes('frais') || txt.includes('commis') || txt.includes('domici') || txt.includes('abon') || off.startsWith('4401011') || off.startsWith('26020100');
  });

  fees.forEach(r => {
    console.log(`Doc: ${r.doc_number} | Amt: ${r.amount_local.toString().padStart(10)} | Off: ${r.counterparty_account} | Txt: ${r.text_desc}`);
  });

  const sumAll = fees.reduce((a, r) => a + r.amount_local, 0);
  console.log('Sum all fees candidates:', sumAll);
  console.log('Target Row 404:', -276581.48);
  console.log('Difference:', sumAll - (-276581.48));

  process.exit(0);
})();
