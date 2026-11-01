import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const u = await p.user.findUnique({ where: { email: "admin@rolesmith.local" } });
console.log(u);
await p.$disconnect();
