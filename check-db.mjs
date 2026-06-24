import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const businesses = await p.business.findMany();
console.log(JSON.stringify(businesses, null, 2));
await p.$disconnect();
