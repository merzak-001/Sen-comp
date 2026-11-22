const sql = require('./sqlDb');

async function findRemaining() {
  const diff = 9490138.06;
  console.log('Remaining diff to explain:', diff);

  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const allPos = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
      AND amount_local > 0
      AND counterparty_account NOT IN ('${bankAccounts.join("','")}')
      AND doc_number NOT IN ('100028948', '2000003376', '2000003402', '2000003391', '2000003431')
  `);
  
  console.log('Clean bank rows remaining:', allPos.length);
  const cleanSum = allPos.reduce((a, b) => a + Number(b.amount_local), 0);
  console.log('Clean sum:', cleanSum);
  console.log('Target:', 348430299.60);
  console.log('Difference:', cleanSum - 348430299.60);

  // Search single item matching difference
  for (const r of allPos) {
    if (Math.abs(r.amount_local - diff) < 1) {
      console.log('MATCH SINGLE:', r);
    }
  }

  // Search pair of items matching difference
  for (let i = 0; i < allPos.length; i++) {
    for (let j = i + 1; j < allPos.length; j++) {
      const s = allPos[i].amount_local + allPos[j].amount_local;
      if (Math.abs(s - diff) < 1) {
        console.log('MATCH PAIR:', allPos[i], allPos[j]);
      }
    }
  }

  // Print all remaining items sorted by amount
  allPos.sort((a, b) => b.amount_local - a.amount_local);
  for (const r of allPos) {
    console.log(`${r.doc_number} | ${r.doc_type} | ${Number(r.amount_local).toLocaleString()} | Off: ${r.counterparty_account} | ${r.text_desc}`);
  }

  process.exit(0);
}

findRemaining();
