const ReportingEngine = require('./reportingEngine');
const XLSX = require('xlsx');

// Load engine
const engine = require('./reportingEngine');

(async () => {
  await engine.loadMasterFiles();

  // Test computeTFTFromBalance
  const cert2025 = engine.loadTFT2025FromExcel ? engine.loadTFT2025FromExcel() : null;
  console.log('Cert 2025 loaded?', !!cert2025);

  // Call getTFTReport(2025)
  const report2025 = await engine.getTFTReport(2025, 'ALL');
  console.log('TFT 2025 hasData:', report2025.hasData);
  console.log('TFT 2025 totA:', report2025.kpis?.fluxA);
  console.log('TFT 2025 totB:', report2025.kpis?.fluxB);
  console.log('TFT 2025 totC:', report2025.kpis?.fluxC);
  console.log('TFT 2025 totVar:', report2025.kpis?.varTreso);
  console.log('TFT 2025 openingCash:', report2025.kpis?.tresoOuv);
  console.log('TFT 2025 closingCash:', report2025.kpis?.tresoClot);
  console.log('Rows count:', report2025.rows?.length);
})();
