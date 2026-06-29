const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // עדכן פרופיל נועה-מטרה להשתמש בעסק "recruitment" הקיים
  await p.profile.update({
    where: { id: "cmqyzfthr0001z3znkvd989kt" },
    data: { businessId: "recruitment" },
  });
  console.log("Updated נועה-מטרה profile to use recruitment business");

  // עדכן user של נועה להשתמש ב-recruitment
  await p.user.update({
    where: { email: "noa@matarahr.co.il" },
    data: { businessId: "recruitment" },
  });
  console.log("Updated noa user to use recruitment business");

  // מחק עסק כפול
  await p.business.delete({ where: { id: "מטרה-גיוס-והשמה" } });
  console.log("Deleted duplicate business מטרה-גיוס-והשמה");
}

main().finally(() => p.$disconnect());
