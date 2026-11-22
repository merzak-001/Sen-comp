const sql = require('./sqlDb');

async function solveSubset() {
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const allPos = await sql.query(`
    SELECT doc_number, doc_type, account, amount_local, text_desc, counterparty_account
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
      AND amount_local > 0
      AND counterparty_account NOT IN ('${bankAccounts.join("','")}')
      AND doc_number NOT IN ('100028948', '2000003376', '2000003402', '2000003391', '2000003431')
  `);

  const targetAug = 348430299.60;
  const targetDiff = 9490138.06;

  console.log(`Checking combinations among ${allPos.length} items to match targetDiff = ${targetDiff}...`);

  // Let's check 1, 2, 3, 4, 5 items that sum to targetDiff
  function search(idx, currentSum, chosen) {
    if (Math.abs(currentSum - targetDiff) < 0.1) {
      console.log('FOUND EXACT MATCH TO EXCLUDE:', chosen.map(x => `${x.doc_number} (${x.amount_local} DA, ${x.text_desc})`));
      return true;
    }
    if (currentSum > targetDiff + 1 || chosen.length >= 6) return false;
    for (let i = idx; i < allPos.length; i++) {
      if (search(i + 1, currentSum + allPos[i].amount_local, [...chosen, allPos[i]])) {
        return true;
      }
    }
    return false;
  }

  const found = search(0, 0, []);
  if (!found) {
    console.log('No exact subset of these 43 items sums to 9,490,138.06.');
    console.log('Checking if another starting set or formula gives 348,430,299.60...');
  }

  process.exit(0);
}

solveSubset();
