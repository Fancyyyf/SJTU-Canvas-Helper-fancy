import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { dueReminderCandidates, markReminderSent, type TodoItem } from "./todo";

export async function enableTodoNotifications() {
  return await isPermissionGranted() || await requestPermission() === "granted";
}

export async function checkTodoReminders(account: string) {
  if (!await isPermissionGranted()) return;
  for (const item of dueReminderCandidates(account)) {
    sendNotification({ title: "TODO 即将到期", body: item.title + (item.courseName ? " · " + item.courseName : "") });
    markReminderSent(account, item);
  }
}

export async function notifyNewAssignments(items: TodoItem[]) {
  if (!await isPermissionGranted()) return;
  for (const item of items.slice(0, 5)) {
    sendNotification({ title: "新增 Canvas 作业", body: item.title + (item.courseName ? " · " + item.courseName : "") });
  }
}
