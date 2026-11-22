const sql = require('./sqlDb');

async function testMatch() {
  const sumPos = 388834336.70;
  const targetAug = 348430299.60;
  
  // Non-client items identified
  const saChange = 751331.05; // 423
  const seaalCaution = 13414593.92; // 413
  const cnasCancel = 3567178.07; // 403
  const hotelMariot = 46268.00;
  const caatAssurance = 76400.00;

  const subtotal1 = sumPos - saChange - seaalCaution - cnasCancel - hotelMariot - caatAssurance;
  console.log('Subtotal after obvious non-401 items:', subtotal1);
  console.log('Difference with targetAug (348 430 299.60):', subtotal1 - targetAug);

  // Difference is 22,548,266.06 DA!
  // Let's see what items in positive sum to 22,548,266.06 or what other items make the exact target!
  const bankAccounts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];
  const bankRows = await sql.query(`
    SELECT doc_type, account, amount_local, text_desc, counterparty_account, doc_number
    FROM FBL3NLineItems
    WHERE fiscal_year = 2026 AND fiscal_month = 8 AND account IN ('${bankAccounts.join("','")}')
      AND amount_local > 0
    ORDER BY doc_number
  `);
  
  const valid = bankRows.filter(r => !(bankAccounts.includes(r.counterparty_account) && r.doc_type !== 'DZ'));
  console.log('\nLooking for subset summing to targetAug:', targetAug);

  // Check all subsets
  function findSubsets(arr, target) {
    // Check single, pairs, triples, etc.
    const diff = subtotal1 - target;
    console.log('We need to find items summing to:', diff);
    for (let i = 0; i < arr.length; i++) {
      if (Math.abs(arr[i].amount_local - diff) < 0.5) {
        console.log('Exact 1-item match:', arr[i]);
      }
      for (let j = i + 1; j < arr.length; j++) {
        if (Math.abs(arr[i].amount_local + arr[j].amount_local - diff) < 0.5) {
          console.log('Exact 2-item match:', arr[i], arr[j]);
        }
        for (let k = j + 1; k < arr.length; k++) {
          if (Math.abs(arr[i].amount_local + arr[j].amount_local + arr[k].amount_local - diff) < 0.5) {
            console.log('Exact 3-item match:', arr[i], arr[j], arr[k]);
          }
        }
      }
    }
  }

  findSubsets(valid, targetAug);
  process.exit(0);
}

testMatch();
