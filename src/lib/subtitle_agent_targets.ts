type ResultFlags = {
  hasCleaned: boolean;
  hasKnowledgeRaw: boolean;
  hasKnowledgeCleaned: boolean;
};

export function missingAgentResults<T extends ResultFlags>(
  items: readonly T[],
  mode: "clean" | "knowledge",
  source: "raw" | "cleaned",
): T[] {
  return items.filter((item) => {
    if (mode === "clean") return !item.hasCleaned;
    return source === "raw" ? !item.hasKnowledgeRaw : !item.hasKnowledgeCleaned;
  });
}

export function cleanedSourceAvailable(items: readonly ResultFlags[]): boolean {
  return items.length > 0 && items.every((item) => item.hasCleaned || item.hasKnowledgeCleaned);
}
