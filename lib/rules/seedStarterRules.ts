import { STARTER_RULES } from "@/lib/rules/starterRules";

type RuleBankRuleClient = {
  upsert: (args: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }) => Promise<unknown>;
};

export async function seedStarterRules(prisma: { ruleBankRule: RuleBankRuleClient }) {
  for (const rule of STARTER_RULES) {
    const data = {
      title: rule.title,
      body: rule.body,
      category: rule.category.toUpperCase(),
      mode: rule.mode.toUpperCase(),
      source: "STARTER",
      scope: "GLOBAL",
      brandId: null,
      targetJson: JSON.stringify(rule.targetJson),
      payloadJson: JSON.stringify(rule.payloadJson),
      enabled: rule.enabled,
    };

    await prisma.ruleBankRule.upsert({
      where: { id: rule.id },
      update: data,
      create: { id: rule.id, ...data },
    });
  }
}
