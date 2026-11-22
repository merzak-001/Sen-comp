const sqlDb = require('./sqlDb');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile('C:/Users/msai/OneDrive - Sensus Germany GmbH & Co. KG/Documents/OS-appro/TFT  DEC 2025.xlsx');
  const ws = wb.Sheets['TFT 2025'];
  const tftData = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const cert425 = [];
  const cert426 = [];
  const cert427 = [];

  for (let r = 5; r <= 33; r++) {
    const row = tftData[r];
    if (!row) continue;
    const code = String(row[1] || '').trim();
    if (code === '425') for (let c = 2; c <= 13; c++) cert425.push(Number(row[c]) || 0);
    if (code === '426') for (let c = 2; c <= 13; c++) cert426.push(Number(row[c]) || 0);
    if (code === '427') for (let c = 2; c <= 13; c++) cert427.push(Number(row[c]) || 0);
  }

  const pKeys = ['012025', '022025', '032025', '042025', '052025', '062025', '072025', '082025', '092025', '102025', '112025', '122025'];
  const cashAccounts = ['11867005', '11867007', '11867008', '11867009', '11867110', '11867210', '11867211', '11867310', '11867311', '10170200'];

  console.log('Month | Calc Ouv | Cert Ouv | Calc Clot | Cert Clot | Calc Var | Cert Var');
  for (let m = 0; m < 12; m++) {
    const pk = pKeys[m];
    const rows = await sqlDb.query(`SELECT SUM(report_initial) as ouv, SUM(solde) as clot FROM GeneralLedgerBalances WHERE period_key = '${pk}' AND boal_account IN ('${cashAccounts.join("','")}')`);
    const calcClot = rows[0]?.clot || 0;
    const calcOuv = m === 0 ? (rows[0]?.ouv || 0) : cert426[m - 1];
    const calcVar = calcClot - calcOuv;
    console.log(`M${m+1} | ${calcOuv.toFixed(2)} | ${cert425[m].toFixed(2)} | ${calcClot.toFixed(2)} | ${cert426[m].toFixed(2)} | ${calcVar.toFixed(2)} | ${cert427[m].toFixed(2)}`);
  }
  process.exit(0);
})();
