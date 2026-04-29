import { GlobalRulesClient } from "@/components/rules/GlobalRulesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/db";
import { listGlobalRules } from "@/lib/rules/ruleBankService";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await listGlobalRules({ prisma });

  return (
    <div className="space-y-8">
      <PageHeader title="Rules Bank" description="Reusable starter and custom rules for hardening Skill Files." />
      <GlobalRulesClient initialRules={rules} />
    </div>
  );
}
