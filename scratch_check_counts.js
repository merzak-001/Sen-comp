const sqlDb = require('./sqlDb');

async function main() {
  try {
    const stats = await sqlDb.getDatabaseStats();
    console.log('Database stats:', JSON.stringify(stats, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
