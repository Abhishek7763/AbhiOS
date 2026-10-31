import { Goal, InboxItem, Task } from '../types';
import { daysBetween } from './dates';

export interface AttentionSummary {
  overdueTasks: Task[]; // due < today, overdue < 14 days
  staleTasks: Task[]; // due <= today - 14 days
  dueSoonTasks: Task[]; // due within next 2 days
  oldInboxItems: InboxItem[]; // status === 'new', older than 2 days
  goalsDueForReview: Goal[]; // active goals where reviewDate <= today
  rescheduleHeavyTasks: Task[]; // active tasks rescheduled >= 3 times
  totalCount: number;
}

/**
 * Section 9.1: Computes all Needs Attention items without guilt/shame scoring.
 * Stale tasks (>=14 days overdue) are separated from regular overdue tasks so they don't hijack priority.
 */
export function computeNeedsAttention(params: {
  tasks: Task[];
  inboxItems: InboxItem[];
  goals: Goal[];
  today: string;
  nowMs?: number;
}): AttentionSummary {
  const { tasks, inboxItems, goals, today, nowMs = Date.now() } = params;

  const overdueTasks: Task[] = [];
  const staleTasks: Task[] = [];
  const dueSoonTasks: Task[] = [];
  const rescheduleHeavyTasks: Task[] = [];

  for (const task of tasks) {
    if (task.status !== 'todo' && task.status !== 'doing') continue;

    if ((task.rescheduleCount ?? 0) >= 3) {
      rescheduleHeavyTasks.push(task);
    }

    if (!task.dueDate) continue;
    const diff = daysBetween(today, task.dueDate); // dueDate - today

    if (diff < 0) {
      const overdueDays = Math.abs(diff);
      if (overdueDays >= 14) {
        staleTasks.push(task);
      } else {
        overdueTasks.push(task);
      }
    } else if (diff >= 0 && diff <= 2) {
      dueSoonTasks.push(task);
    }
  }

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  const oldInboxItems = inboxItems.filter((item) => {
    if (item.status !== 'new') return false;
    const createdMs = new Date(item.createdAt).getTime();
    if (isNaN(createdMs)) return false;
    return nowMs - createdMs >= twoDaysMs;
  });

  const goalsDueForReview = goals.filter((goal) => {
    if (goal.status !== 'active') return false;
    if (!goal.reviewDate) return false;
    return daysBetween(today, goal.reviewDate) <= 0;
  });

  const totalCount =
    overdueTasks.length +
    staleTasks.length +
    goalsDueForReview.length +
    rescheduleHeavyTasks.length;

  return {
    overdueTasks,
    staleTasks,
    dueSoonTasks,
    oldInboxItems,
    goalsDueForReview,
    rescheduleHeavyTasks,
    totalCount,
  };
}

/**
 * Section 8.9: Returns true if the user is returning after a gap > 3 days.
 */
export function shouldShowReEntry(
  lastActiveDate: string | null | undefined,
  today: string
): boolean {
  if (!lastActiveDate) return false;
  const gapDays = daysBetween(lastActiveDate, today);
  return gapDays > 3;
}
