const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(body));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const tft25 = await fetchJson('http://localhost:50/api/tft?year=2025&month=ALL');
  console.log('API TFT 2025 ALL Success:', tft25.success);
  console.log('KPIs 2025:', tft25.tft.kpis);
  console.log('Rows count 2025:', tft25.tft.rows.length);

  const tft25_10 = await fetchJson('http://localhost:50/api/tft?year=2025&month=10');
  console.log('API TFT 2025 M10 KPIs:', tft25_10.tft.kpis);

  const tft26 = await fetchJson('http://localhost:50/api/tft?year=2026&month=ALL');
  console.log('API TFT 2026 ALL Success:', tft26.success);
  console.log('KPIs 2026:', tft26.tft.kpis);

  const tft24 = await fetchJson('http://localhost:50/api/tft?year=2024&month=ALL');
  console.log('API TFT 2024 ALL Success:', tft24.success);
  console.log('KPIs 2024:', tft24.tft.kpis);
}

run().catch(console.error);
