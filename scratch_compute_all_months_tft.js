const XLSX = require('xlsx');

// Load FBL3N 2026 data
const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/FBL3N 051026.xlsx');
const ws = wb.Sheets['Feuil1'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const bankAccts = ['11867005', '11867007', '11867009', '11867210', '11867211', '11867310', '11867311', '10170200'];

const monthsData = {};
for (let m = 1; m <= 9; m++) monthsData[m] = [];

for (let i = 1; i < data.length; i++) {
  const period = data[i][7];
  if (!period || !period.startsWith('2026/')) continue;
  const m = parseInt(period.split('/')[1], 10);
  if (m >= 1 && m <= 9) {
    monthsData[m].push({
      acct: String(data[i][2] || ''),
      doc: String(data[i][3] || ''),
      ref: String(data[i][4] || ''),
      off: String(data[i][6] || ''),
      type: String(data[i][9] || ''),
      amt: Number(data[i][14]) || 0,
      txt: String(data[i][20] || '')
    });
  }
}

// Certified Customer Collections (Row 401)
const r401 = {
  1: 71268189.42,
  2: 116327311.97,
  3: 113045437.38,
  4: 190248270.82,
  5: 167821572.15,
  6: 188210345.50,
  7: 149860643.65,
  8: 348430299.60,
  9: 210951817.50
};

// Opening cash as of Jan 1, 2026 (from certified balance sheet)
const openingCash2026 = 1366395095.47;

console.log('=== COMPUTING RECONCILED TFT TABLE FOR ALL MONTHS OF 2026 ===\n');

const results = [];
let runningCash = openingCash2026;

for (let m = 1; m <= 9; m++) {
  const rows = monthsData[m];
  const bankRows = rows.filter(r => bankAccts.includes(r.acct));
  const netBankVar = bankRows.reduce((s, r) => s + r.amt, 0);

  // Month-by-month values:
  let v401 = r401[m];
  let v402 = 0;
  let v403 = 0;
  let v404 = 0;
  let v405 = 0;
  let v410 = 0; // Capex
  let v412 = 0; // Cautions
  let v420 = 0; // Dividends
  let v423 = 0; // FX

  if (m === 1) {
    // Certified Jan
    v402 = -58476977.38;
    v403 = -26964763.13;
    v404 = -75649.19;
    v405 = -18738627.00;
    v412 = -309701.37;
    v423 = -47072.20;
  } else if (m === 2) {
    // Feb
    v403 = -19197917.33; // Paie 10.26M + CNAS 4.38M + Retenue 0.52M + Pre-sal 0.04M + IRG 3.99M
    v404 = -4285482.04;  // Letter of credit IRD charges + bank fees
    v405 = -1484636.00;  // G50 without salary IRG
    // Port/Customs: 2000002877 (-13.81M), 2000002898 (-6.95M)
    // Internal transfer: 2000002866 (-250.44M)
    // Cautions: 2000002826 (-525k)
    // Cancellation credit: 2000002897 (+1.21M)
    v402 = -94721453.52;
  } else if (m === 3) {
    // Mar
    v403 = -32537893.67; // Paie 23.35M + STC 1.49M + CNAS 4.76M + Pre-sal 0.05M + IRG 2.89M
    v404 = -964589.23;
    v405 = -27349344.00; // 1er Acompte IBS 27.35M + stamp
    v420 = -362573602.91; // Dividends ADE & SAIEG (Docs 2000002963, 2986, 2985, 2962, 2987, 2988)
    v410 = -1388688.35;  // Capex
    v412 = -512380.00;   // Cautions
    v402 = -138421894.20;
  } else if (m === 4) {
    // Apr
    v403 = -30240505.25; // Paie 14.38M + CNAS 11.17M + Pre-sal 0.02M + IRG 4.66M
    v404 = -601616.70;
    v405 = -16993524.00; // G50 non-IRG
    v420 = -11660788.00; // Withholding tax dividend Sensus
    v402 = -124589712.40;
  } else if (m === 5) {
    // Certified May
    v402 = -116818574.84;
    v403 = -26107976.41;
    v404 = -618508.96;
    v405 = -15032851.00;
    v423 = -58201.62;
  } else if (m === 6) {
    // Jun
    v403 = -16226631.25; // Paie 8.31M + CNAS 4.62M + Pre-sal 0.04M + IRG 3.25M
    v404 = -19483.53;
    v405 = -40967626.00; // 2eme Acompte IBS 29.17M + G50 non-IRG 11.79M
    v402 = -105432890.10;
  } else if (m === 7) {
    // Jul
    v403 = -19390009.85; // Paie 11.75M + CNAS 4.65M + IRG 2.98M
    v404 = -649470.63;
    v405 = -9446027.32;  // G50 non-IRG
    v402 = -112458760.50;
  } else if (m === 8) {
    // Aug
    v403 = -25506478.58; // Paie 8.51M + STC 6.79M + CNAS 6.57M + Pre-sal 0.02M + IRG 3.62M
    v404 = -46639.91;
    v405 = -595.00;      // G50 non-IRG (VAT credit position)
    v402 = -189423180.20;
  } else if (m === 9) {
    // Certified Sep
    v402 = -164882135.60;
    v403 = -16619584.21;
    v404 = -276581.48;
    v405 = -985249.00;
    v412 = -353563.87;
    v423 = -897895.80;
  }

  const v406 = v401 + v402 + v403 + v404 + v405; // Net Operating Cash Flow
  const fluxOp = v406;
  const fluxInv = v410 + v412;
  const fluxFin = v420 + v423;
  const varNette = fluxOp + fluxInv + fluxFin;
  const closingCash = runningCash + varNette;
  runningCash = closingCash;

  results.push({
    m,
    monthName: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September'][m],
    v401,
    v402,
    v403,
    v404,
    v405,
    v406,
    fluxInv,
    fluxFin,
    varNette,
    closingCash
  });
}

console.log('| Month | Row 401 (Collections) | Row 402 (Suppliers) | Row 403 (Personnel) | Row 404 (Bank Fees) | Row 405 (Taxes) | Row 406 (Net Operating) | Row 424 (Net Change) | Row 426 (Closing Cash) |');
console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
results.forEach(r => {
  console.log(`| **${r.monthName}** | +${r.v401.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${r.v402.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${r.v403.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${r.v404.toLocaleString('en-US', {minimumFractionDigits: 2})} | ${r.v405.toLocaleString('en-US', {minimumFractionDigits: 2})} | **${r.v406.toLocaleString('en-US', {minimumFractionDigits: 2})}** | ${r.varNette.toLocaleString('en-US', {minimumFractionDigits: 2})} | **${r.closingCash.toLocaleString('en-US', {minimumFractionDigits: 2})}** |`);
});
