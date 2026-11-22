const engine = require('../reportingEngine');

const tft25 = engine.getTFTReport('2025', 'ALL');
console.log('2025 row 401:');
const r401 = tft25.rows.find(r => r.note === '401');
console.log(r401);

const r408 = tft25.rows.find(r => r.note === '408');
console.log('2025 row 408 (A):', r408);

const r424 = tft25.rows.find(r => r.note === '424');
console.log('2025 row 424 (Var):', r424);

const r425 = tft25.rows.find(r => r.note === '425');
console.log('2025 row 425 (Ouv):', r425);

const r426 = tft25.rows.find(r => r.note === '426');
console.log('2025 row 426 (Clot):', r426);
