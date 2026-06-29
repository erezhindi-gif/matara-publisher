const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.group.deleteMany({});
  console.log(`מחקנו ${groups.count} קבוצות`);

  const templates = await prisma.groupTemplate.deleteMany({});
  console.log(`מחקנו ${templates.count} תבניות`);

  const syncJobs = await prisma.syncJob.deleteMany({});
  console.log(`מחקנו ${syncJobs.count} משימות סנכרון`);
}

main().then(() => { console.log("נקיון הושלם"); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
