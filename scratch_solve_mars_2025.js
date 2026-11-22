const sqlDb = require('./sqlDb');

(async () => {
  const target = 242430317.89;

  // Components:
  const salesLocalHT = 192788710 + 5583720 + 6456200; // 204828630
  const salesTTC = salesLocalHT * 1.19; // 243746069.7

  const d10 = 62374159.40;
  const d30 = -58025711.94;
  const dRec = d10 + d30; // 4348447.46

  const dAdv = -2625027.20; // 14060016

  const forCred = 421462.63; // 14050500 credit
  const forDebit = 1932199.18; // 14050500 debit
  const forDelta = 1510736.55; // 14050500 delta

  console.log('Target:', target);
  console.log('Local Sales HT:', salesLocalHT);
  console.log('Local Sales TTC:', salesTTC);
  console.log('Delta 14000010:', d10);
  console.log('Delta 14000030:', d30);
  console.log('Delta Rec (10+30):', dRec);
  console.log('Delta Adv (16):', dAdv);
  console.log('Foreign Credit (14050500):', forCred);

  // Check simple formula:
  // Option 1: salesTTC - dRec - dAdv + forCred
  console.log('\nOption 1 (salesTTC - dRec - dAdv + forCred):', salesTTC - dRec - dAdv + forCred);
  console.log('Option 2 (salesTTC - dRec + dAdv + forCred):', salesTTC - dRec + dAdv + forCred);
  console.log('Option 3 (salesTTC - (dRec + dAdv)):', salesTTC - (dRec + dAdv));

  // Also check Credits of Client Accounts:
  // In March 2025:
  // 14000010 Credit = 107623980.80
  // 14000030 Credit = 132497994.44
  // 14060016 Credit = 23870435.85 (or net = 23870435.85 - 21245408.65 = 2625027.20)
  // 14050500 Credit = 421462.63
  const cred10 = 107623980.80;
  const cred30 = 132497994.44;
  const cred16 = 23870435.85;
  const credExp = 421462.63;

  console.log('\n--- CREDITS OF CLIENT ACCOUNTS ---');
  console.log('Credit 14000010 + Credit 14000030:', cred10 + cred30);
  console.log('Credit 10 + Credit 30 + Credit Exp:', cred10 + cred30 + credExp);
  console.log('Diff vs Target:', (cred10 + cred30 + credExp) - target);

  // Let's inspect FBL3N or Bank receipts for 2025 if available or Sheet 5 / Sheet BEA in TFT DEC 2025.xlsx
  process.exit(0);
})();
