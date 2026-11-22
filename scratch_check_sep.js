const sql = require('./sqlDb');

async function run() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const rows = await sql.query(`
    SELECT doc_type, account, amount_local, text_desc, counterparty_account, doc_number
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 9 AND account IN ('${bankAccounts.join("','")}')
  `);
  console.log('Total rows in Sep 2026:', rows.length);
  
  // Filter out internal bank transfers
  const validRows = rows.filter(r => !(bankAccounts.includes(r.counterparty_account) && r.doc_type !== 'DZ'));
  console.log('Valid non-internal rows in Sep 2026:', validRows.length);

  const positive = validRows.filter(r => r.amount_local > 0);
  const sumPos = positive.reduce((a,b) => a + Number(b.amount_local), 0);
  console.log('Sum positive in Sep:', sumPos);
  
  const byDt = {};
  for (const r of positive) {
    byDt[r.doc_type] = (byDt[r.doc_type] || 0) + Number(r.amount_local);
  }
  console.log('Positive by doc_type:', byDt);

  const target = 210951817.50;
  const withoutSimonfond = positive.filter(r => !String(r.text_desc).includes('SIMONFOND'));
  const sumWithout = withoutSimonfond.reduce((a,b) => a + Number(b.amount_local), 0);
  console.log('Sum without Simonfond:', sumWithout);
  console.log('Target:', target);
  console.log('Diff:', sumWithout - target);

  const diff = sumWithout - target;
  console.log('Diff to explain:', diff);
  for (let i = 0; i < withoutSimonfond.length; i++) {
    for (let j = i + 1; j < withoutSimonfond.length; j++) {
      const s2 = withoutSimonfond[i].amount_local + withoutSimonfond[j].amount_local;
      if (Math.abs(s2 - diff) < 1) {
        console.log('MATCH 2 items:', withoutSimonfond[i], withoutSimonfond[j]);
      }
    }
  }
  // Also check non-client text or counterparty in withoutSimonfond
  for (const r of withoutSimonfond) {
    if (r.doc_type !== 'DZ' || !r.counterparty_account.startsWith('76') && !r.counterparty_account.startsWith('77')) {
      console.log('Non standard client doc:', r.doc_number, r.doc_type, r.amount_local, r.counterparty_account, r.text_desc);
    }
  }



  process.exit(0);
}
run();
