const XLSX = require('xlsx');
const sqlDb = require('./sqlDb');

(async () => {
  // 1. Check FBL3N Bank receipts with counterparty in 140* or client related
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
  const ws = wb.Sheets['Feuil1'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

  const m3Bank = [];
  for (let i = 1; i < data.length; i++) {
    const period = data[i][7];
    if (period === '2026/03' || period === '2026/3') {
      const acct = String(data[i][2] || '');
      if (bankAccts.includes(acct)) {
        m3Bank.push({
          acct,
          doc: String(data[i][3] || ''),
          type: String(data[i][9] || ''),
          amt: Number(data[i][14]) || 0,
          off: String(data[i][6] || ''),
          txt: String(data[i][20] || '')
        });
      }
    }
  }

  console.log('--- ALL BANK RECEIPTS IN M3 (amt > 0) ---');
  let sumAllReceipts = 0;
  let sumCustomerReceipts = 0;
  m3Bank.filter(r => r.amt > 0).forEach(r => {
    sumAllReceipts += r.amt;
    const isCust = r.off.startsWith('140') || r.type === 'DZ';
    if (isCust) sumCustomerReceipts += r.amt;
    console.log(`Doc: ${r.doc} | Type: ${r.type} | Amt: ${r.amt} | Off: ${r.off} | Cust: ${isCust} | Txt: ${r.txt}`);
  });

  console.log('\nSum of all bank positive receipts in M3:', sumAllReceipts);
  console.log('Sum of customer-tagged receipts in M3:', sumCustomerReceipts);

  // 2. Query Balance for Period 022026 and 032026
  const p2 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '022026'");
  const p3 = await sqlDb.query("SELECT * FROM GeneralLedgerBalances WHERE period_key = '032026'");

  // Sales in M3:
  const s88010031 = getMonthMovement('88010031', p2, p3);
  const s88010039 = getMonthMovement('88010039', p2, p3);
  const s88010053 = getMonthMovement('88010053', p2, p3);
  const s88030510 = getMonthMovement('88030510', p2, p3);

  console.log('\n--- SALES MOVEMENTS IN BALANCE M3 ---');
  console.log('88010031 (Ventes PF local):', s88010031);
  console.log('88010039 (Ventes div local):', s88010039);
  console.log('88010053 (Ventes march local):', s88010053);
  console.log('88030510 (Ventes Export):', s88030510);

  const localSalesHT = (s88010031.credit - s88010031.debit) + (s88010039.credit - s88010039.debit) + (s88010053.credit - s88010053.debit);
  const foreignSalesHT = (s88030510.credit - s88030510.debit);
  console.log('Total Local Sales HT:', localSalesHT);
  console.log('Total Foreign Sales HT:', foreignSalesHT);

  // Receivables in M3:
  const c14000010 = getSoldeChange('14000010', p2, p3);
  const c14000030 = getSoldeChange('14000030', p2, p3);
  const c14050500 = getSoldeChange('14050500', p2, p3);
  const c14060016 = getSoldeChange('14060016', p2, p3);

  console.log('\n--- CLIENT RECEIVABLE BALANCES (SOLDE) ---');
  console.log('14000010 (Domestiques):', c14000010);
  console.log('14000030 (ADE):', c14000030);
  console.log('14050500 (Clients Groupe / Export):', c14050500);
  console.log('14060016 (Avances Clients):', c14060016);

  // Let's test various combinations:
  // Case A: FBL3N Credit of Client accounts
  // In FBL3N, what was the credit on 14000010, 14000030, etc.?
  // Case B: Accountant formula on Local + Foreign
  // Case C: Actual Cash Received in Bank
  console.log('\n--- TARGET COMPARISONS ---');
  console.log('Target from scratch_compute_all_months_tft.js: 113,045,437.38');
  console.log('Target from scratch_tft_summary_table.js:      113,048,059.35');

  function getMonthMovement(boal, balPrev, balCurr) {
    const rPrev = balPrev.find(x => x.boal_account === boal) || { debit: 0, credit: 0, solde: 0 };
    const rCurr = balCurr.find(x => x.boal_account === boal) || { debit: 0, credit: 0, solde: 0 };
    return {
      debit: rCurr.debit - rPrev.debit,
      credit: rCurr.credit - rPrev.credit,
      soldePrev: rPrev.solde,
      soldeCurr: rCurr.solde
    };
  }

  function getSoldeChange(boal, balPrev, balCurr) {
    const rPrev = balPrev.find(x => x.boal_account === boal) || { debit: 0, credit: 0, solde: 0 };
    const rCurr = balCurr.find(x => x.boal_account === boal) || { debit: 0, credit: 0, solde: 0 };
    return {
      prev: rPrev.solde,
      curr: rCurr.solde,
      delta: rCurr.solde - rPrev.solde,
      mDebit: rCurr.debit - rPrev.debit,
      mCredit: rCurr.credit - rPrev.credit
    };
  }

  process.exit(0);
})();
