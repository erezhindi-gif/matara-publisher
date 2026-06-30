const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.post.findMany({ take: 10, orderBy: { createdAt: "desc" } });
  console.log(JSON.stringify(posts, null, 2));
}
main().finally(() => process.exit(0));
