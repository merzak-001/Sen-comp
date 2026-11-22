async function run() {
  try {
    const tcr = await (await fetch('http://localhost:8050/api/tcr')).json();
    const bilan = await (await fetch('http://localhost:8050/api/bilan')).json();
    const tft = await (await fetch('http://localhost:8050/api/tft')).json();
    const bal = await (await fetch('http://localhost:8050/api/balance')).json();
    
    console.log('--- TCR ---');
    console.log('hasData:', tcr.tcr?.hasData, 'rows:', tcr.tcr?.rows?.length, 'kpis:', tcr.tcr?.kpis);
    
    console.log('--- BILAN ---');
    console.log('hasData:', bilan.bilan?.hasData, 'kpis:', bilan.bilan?.kpis);
    
    console.log('--- TFT ---');
    console.log('kpis:', tft.tft?.kpis);
    
    console.log('--- BALANCE ---');
    console.log('count:', bal.count, 'accounts:', bal.accounts?.length);

    // Also test 2025
    const tcr25 = await (await fetch('http://localhost:8050/api/tcr?year=2025')).json();
    const bilan25 = await (await fetch('http://localhost:8050/api/bilan?year=2025')).json();
    console.log('--- TCR 2025 ---');
    console.log('hasData:', tcr25.tcr?.hasData, 'rows:', tcr25.tcr?.rows?.length, 'kpis:', tcr25.tcr?.kpis?.caN);
    console.log('--- BILAN 2025 ---');
    console.log('hasData:', bilan25.bilan?.hasData, 'actif:', bilan25.bilan?.kpis?.totalActifNetN);
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
