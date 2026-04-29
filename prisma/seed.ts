import { prisma } from "../lib/db";
import { seedStarterRules } from "../lib/rules/seedStarterRules";

async function main() {
  await seedStarterRules(prisma);

  const count = await prisma.brand.count();
  if (count > 0) {
    return;
  }

  await prisma.brand.create({
    data: {
      name: "Example Founder Voice",
      twitterHandle: "@example",
      category: "Founder",
      audience: "builders, indie hackers, startup operators",
      description: "A sample workspace for testing the local MVP.",
      beliefs: "specific beats generic\nplain language beats hype",
      avoidSoundingLike: "corporate launch copy, vague AI hype",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
