import { PrismaClient } from "@prisma/client";

const id = process.argv[2];
const p = new PrismaClient();
const s = await p.practiceSession.findUnique({
  where: { id },
  include: { score: true, transcript: true, scenario: true },
});
if (!s) {
  console.error("not found");
  process.exit(1);
}
console.log("--- transcript ---");
console.log(JSON.stringify(s.transcript?.turns, null, 2));
console.log("--- score criteria ---");
console.log(JSON.stringify(s.score?.criteria, null, 2));
console.log("--- strengths ---");
console.log(JSON.stringify(s.score?.strengths, null, 2));
console.log("--- improvements ---");
console.log(JSON.stringify(s.score?.improvements, null, 2));
console.log("--- coach ---");
console.log(s.score?.coachNotes);
console.log("--- metrics ---");
console.log(JSON.stringify(s.score?.metrics, null, 2));
await p.$disconnect();
