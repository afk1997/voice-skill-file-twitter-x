export function nextSkillVersion(currentVersion?: string | null) {
  if (!currentVersion) return "v1.0";
  const match = currentVersion.match(/^v(\d+)\.(\d+)$/);
  if (!match) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return `v${major}.${minor + 1}`;
}
