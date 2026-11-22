function compute2026Monthly() {
  const monthsDZ = [250000000, 257831223.40, 230958934.70, 377433482.40, 353127770.65, 388979240.80, 399116524.97, 695967074.56, 448654600.20, 68925090.00, 0, 0];
  const monthsKZ = [-180000000, -176261014.80, -538000833.12, -353365139.66, -224993426.94, -360673126.66, -315437934.86, -253938986.28, -466068998.50, -192327544.88, 0, 0];
  const monthsPaie = [-35000000, -34500000, -35200000, -34800000, -35100000, -34900000, -35000000, -34700000, -34500000, -34500000, 0, 0];
  const monthsAgios = [-400000, -380000, -420000, -390000, -410000, -395000, -405000, -385000, -395000, -370000, 0, 0];
  const monthsImpot = [-32000000, -31500000, -33000000, -31000000, -32500000, -31200000, -32000000, -31800000, -32800000, -25000000, 0, 0];

  const monthsA = [];
  for (let m = 0; m < 12; m++) {
    monthsA.push(monthsDZ[m] + monthsKZ[m] + monthsPaie[m] + monthsAgios[m] + monthsImpot[m]);
  }

  const monthsB = [-5000000, -4800000, -5200000, -4500000, -4900000, -4200000, -4600000, -4300000, -4100000, -3150000, 0, 0];
  const monthsC = [185000, 185000, 185000, 185000, -142315000, 185000, 185000, -142315000, 185000, 185000, 0, 0];

  const monthsVar = [];
  for (let m = 0; m < 12; m++) {
    monthsVar.push(monthsA[m] + monthsB[m] + monthsC[m]);
  }

  const monthsOuv = [];
  const monthsClot = [];
  let currentCash = 1366395095.47; // 01/01/2026

  for (let m = 0; m < 12; m++) {
    monthsOuv.push(currentCash);
    currentCash += monthsVar[m];
    monthsClot.push(currentCash);
  }

  console.log('Month by month check:');
  for (let m = 0; m < 12; m++) {
    const diff = (monthsClot[m] - monthsOuv[m]) - monthsVar[m];
    console.log(`M${m+1}: Ouv=${monthsOuv[m].toFixed(2)} | Var=${monthsVar[m].toFixed(2)} | Clot=${monthsClot[m].toFixed(2)} | Ecart=${diff.toFixed(2)}`);
  }
}

compute2026Monthly();
