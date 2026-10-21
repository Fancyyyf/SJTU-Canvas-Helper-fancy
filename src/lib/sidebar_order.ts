export function moveSidebarItem(keys: string[], dragged: string, target: string, after: boolean): string[] {
  if (dragged === target || !keys.includes(dragged) || !keys.includes(target)) return keys;
  const next = keys.filter((key) => key !== dragged);
  const targetIndex = next.indexOf(target);
  next.splice(targetIndex + (after ? 1 : 0), 0, dragged);
  return next;
}
