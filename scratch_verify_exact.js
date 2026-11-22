const sqlDb = require('./sqlDb');

(async () => {
  console.log('=== VERIFYING EXACT NUMBERS ===');
  const dCash = 4731686.32;
  const r401 = 92623696.80;
  const r403 = -16413689.20;
  const r404 = -175746.88;
  const r405 = -6239431.00;
  const r423 = -3749.21;

  const others = r401 + r403 + r404 + r405 + r423;
  const r402 = dCash - others;

  console.log('dCash:', dCash);
  console.log('others:', others);
  console.log('r402:', r402);
  console.log('Target: -65059394.19');
  console.log('Diff:', r402 - (-65059394.19));
})();
