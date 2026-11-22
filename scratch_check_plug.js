const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
const ws = wb.Sheets['TFT 2025'];
const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

const getRow = (code) => {
  for (let r = 5; r <= 35; r++) {
    const row = tftData[r];
    if (row && String(row[1] || '').trim() === String(code)) {
      const vals = [];
      for (let c = 2; c <= 13; c++) vals.push(Number(row[c]) || 0);
      return vals;
    }
  }
  return new Array(12).fill(0);
};

const r401 = getRow('401');
const r402 = getRow('402');
const r403 = getRow('403');
const r404 = getRow('404');
const r405 = getRow('405');
const r407 = getRow('407');
const r410 = getRow('410');
const r411 = getRow('411');
const r412 = getRow('412');
const r413 = getRow('413');
const r414 = getRow('414');
const r415 = getRow('415');
const r418 = getRow('418');
const r419 = getRow('419');
const r420 = getRow('420');
const r421 = getRow('421');
const r423 = getRow('423');
const r424 = getRow('424');

console.log('=== VERIFYING IF ROW 402 IS THE CASH-EQUILIBRIUM PLUG FOR ALL 12 MONTHS OF 2025 ===\n');

for (let m = 0; m < 12; m++) {
  const mm = String(m + 1).padStart(2, '0');
  const otherA = r401[m] + r403[m] + r404[m] + r405[m] + r407[m];
  const b = r410[m] + r411[m] + r412[m] + r413[m] + r414[m] + r415[m];
  const c = r418[m] + r419[m] + r420[m] + r421[m] + r423[m];
  
  // If 402 is cash equilibrium:
  // r424 = otherA + 402 + b + c
  // 402 = r424 - (otherA + b + c)
  const calc402 = r424[m] - (otherA + b + c);
  const cert402 = r402[m];
  const diff = calc402 - cert402;

  console.log(`Month ${mm}: Calc 402 = ${calc402.toFixed(2)} | Cert 402 = ${cert402.toFixed(2)} | Diff = ${diff.toFixed(4)}`);
}
