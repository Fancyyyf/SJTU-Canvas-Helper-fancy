export async function runLimited<T>(
  items: readonly T[],
  limit: number,
  process: (item: T, index: number) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (!shouldStop() && next < items.length) {
      const index = next++;
      await process(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(limit))) }, worker));
}
