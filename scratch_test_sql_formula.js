const sqlDb = require('./sqlDb');

(async () => {
  const scfRows = await sqlDb.query(`
    SELECT fiscal_month, account, doc_type, amount_local, doc_number, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND (
      account IN ('14000010', '14000030', '14060016', '88010031', '88010039', '88010053')
      OR (doc_type = 'DZ' AND (counterparty_account = '38147' OR text_desc LIKE '%SENSUS FRANCE%' OR text_desc LIKE '%DEVIS SENSUS%') AND amount_local > 0 AND account != '21040102')
    )
    ORDER BY fiscal_month, doc_number
  `);

  const domSalesAccts = ['88010031', '88010039', '88010053'];
  const domClientAccts = ['14000010', '14000030'];

  const results = {};
  for (let m = 2; m <= 9; m++) {
    const mData = scfRows.filter(r => r.fiscal_month === m);
    const salesHT = mData.filter(r => domSalesAccts.includes(r.account))
      .reduce((a, r) => a - Number(r.amount_local), 0);
    const salesTTC = salesHT * 1.19;

    const domMovements = mData.filter(r => domClientAccts.includes(r.account))
      .reduce((a, r) => a + Number(r.amount_local), 0);
    const varDomReceivables = -domMovements;

    const advMovements = mData.filter(r => r.account === '14060016')
      .reduce((a, r) => a + Number(r.amount_local), 0);
    const varAdvances = -advMovements;

    const dom401 = salesTTC + varDomReceivables + varAdvances;

    const foreignReceipts = mData.filter(r =>
      r.doc_type === 'DZ' && (r.counterparty_account === '38147' || String(r.text_desc).includes('SENSUS FRANCE') || String(r.text_desc).includes('DEVIS SENSUS')) && r.amount_local > 0 && r.account !== '21040102'
    ).reduce((a, r) => a + Number(r.amount_local), 0);

    results[m] = Math.round((dom401 + foreignReceipts) * 100) / 100;
  }

  console.log('SQL Dynamic Results:');
  console.log(results);
  process.exit(0);
})();
