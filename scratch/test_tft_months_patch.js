const engine = require('../reportingEngine');

// Check if we can patch getTFTReport to return months for 2025 and 2026
const tft = engine.getTFTReport('2025', 'ALL');
console.log('Sample row with months:');
const r = tft.rows.find(x => x.note === '401');
console.log(r);
