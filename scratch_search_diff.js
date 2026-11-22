const sql = require('./sqlDb');

async function searchDiff() {
  const diff = 22548266.06;
  console.log('Searching for items matching diff:', diff);

  // Search in FBL3NLineItems in fiscal_year 2026, month 8
  const q = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8
      AND (
        ABS(amount_local - ${diff}) < 1000
        OR ABS(ABS(amount_local) - ${diff}) < 1000
        OR ABS(amount_local - 33353411.94) < 1000
        OR ABS(amount_local - 40404037.10) < 1000
      )
  `);
  console.log('Direct matches in Month 8:', q);

  // Search any combination of 2 items in DZ or ZP that equals 22548266.06
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const allPos = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
      AND amount_local > 0
  `);
  
  for (let i = 0; i < allPos.length; i++) {
    for (let j = 0; j < allPos.length; j++) {
      if (i === j) continue;
      const s = allPos[i].amount_local + allPos[j].amount_local;
      if (Math.abs(s - diff) < 1) {
        console.log('2 items sum to diff:', allPos[i], allPos[j]);
      }
    }
  }

  // Also check if any DZ document in August is NOT client collection:
  // e.g. What are all the counterparties in DZ?
  const dzRows = allPos.filter(r => r.doc_type === 'DZ');
  console.log('\n--- ALL DZ ROWS IN AUGUST ---');
  for (const r of dzRows) {
    console.log(r.doc_number, r.amount_local, r.counterparty_account, r.text_desc);
  }

  process.exit(0);
}

searchDiff();
