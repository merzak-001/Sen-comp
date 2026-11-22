const sql = require('./sqlDb');

async function investigateJan() {
  console.log('=== DEEP DIVE INTO JANUARY 2026 (MONTH 1) ===\n');

  // 1. All rows in FBL3NLineItems for fiscal_year = 2026, fiscal_month = 1
  const allRows = await sql.query(`
    SELECT account, doc_number, doc_type, amount_local, text_desc, counterparty_account, posting_date, doc_date
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 1
    ORDER BY doc_number
  `);
  console.log(`Total rows in Month 1 of 2026: ${allRows.length}`);

  // Group by account
  const byAcct = {};
  for (const r of allRows) {
    byAcct[r.account] = (byAcct[r.account] || 0) + Number(r.amount_local);
  }
  console.log('Net amount by account in Month 1:');
  console.table(Object.entries(byAcct).map(([acc, amt]) => ({ account: acc, net: Number(amt).toLocaleString('fr-FR') })));

  // Let's check bank transactions in Month 1
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const bankRows = allRows.filter(r => bankAccounts.includes(r.account));
  console.log(`Bank rows in Month 1 (count: ${bankRows.length}):`);
  console.table(bankRows.map(r => ({
    doc: r.doc_number,
    type: r.doc_type,
    acct: r.account,
    amt: Number(r.amount_local).toLocaleString('fr-FR'),
    off: r.counterparty_account,
    txt: r.text_desc,
    date: r.posting_date
  })));

  // Let's check client transactions (14000010, 14000030, 14050500, 14060016) in Month 1
  const clientRows = allRows.filter(r => r.account.startsWith('140'));
  console.log(`Client rows in Month 1 (count: ${clientRows.length}):`);
  console.table(clientRows.map(r => ({
    doc: r.doc_number,
    type: r.doc_type,
    acct: r.account,
    amt: Number(r.amount_local).toLocaleString('fr-FR'),
    off: r.counterparty_account,
    txt: r.text_desc,
    date: r.posting_date
  })));

  // Let's check sales transactions (88*) in Month 1
  const salesRows = allRows.filter(r => r.account.startsWith('88'));
  console.log(`Sales rows in Month 1 (count: ${salesRows.length}):`);
  console.table(salesRows.map(r => ({
    doc: r.doc_number,
    type: r.doc_type,
    acct: r.account,
    amt: Number(r.amount_local).toLocaleString('fr-FR'),
    off: r.counterparty_account,
    txt: r.text_desc,
    date: r.posting_date
  })));

  process.exit(0);
}

investigateJan();
