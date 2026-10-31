import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. User Settings (1 row per user)
export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),
  wakeTime: text('wake_time').notNull().default('06:30'),
  quietStart: text('quiet_start').notNull().default('23:00'),
  quietEnd: text('quiet_end').notNull().default('06:00'),
  dayRolloverHour: integer('day_rollover_hour').notNull().default(4),
  dailyWorkloadMinutes: integer('daily_workload_minutes').notNull().default(120),
  dutyPromptTime: text('duty_prompt_time').notNull().default('06:45'),
  reviewTime: text('review_time').notNull().default('21:30'),
  maxRemindersPerDay: integer('max_reminders_per_day').notNull().default(8),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  lastActiveDate: text('last_active_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Life Areas
export const lifeAreas = pgTable('life_areas', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // 'active' | 'archived'
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Universal Brain Dump / Inbox Items (V2 Extended)
export const inboxItems = pgTable('inbox_items', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  status: text('status').notNull().default('new'), // 'new' | 'processing' | 'waiting' | 'processed' | 'someday' | 'archived' | 'trash'
  itemType: text('item_type').notNull().default('unknown'), // 'unknown' | 'task' | 'goal_candidate' | 'project' | 'habit_candidate' | 'reference' | 'idea' | 'concern' | 'waiting_for' | 'duplicate'
  source: text('source').notNull().default('manual'), // 'manual' | 'quick_capture' | 'split'
  lifeAreaId: text('life_area_id'),
  tags: jsonb('tags').default([]),
  decisionNote: text('decision_note'),
  linkedEntityType: text('linked_entity_type'), // 'task' | 'goal' | 'project' | 'routine' | 'split_multiple'
  linkedEntityId: text('linked_entity_id'),
  aiSuggestionJson: jsonb('ai_suggestion_json'),
  processedAt: timestamp('processed_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Provenance Link Table for Splits & Multi-Entity Outputs
export const inboxLinks = pgTable('inbox_links', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  inboxItemId: text('inbox_item_id').notNull(),
  targetType: text('target_type').notNull(), // 'task' | 'goal' | 'project' | 'routine' | 'inbox_item'
  targetId: text('target_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Goals (Quality-Gated V2: Candidate vs Active)
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  lifeAreaId: text('life_area_id').notNull(),
  title: text('title').notNull(),
  desiredOutcome: text('desired_outcome'),
  purposeReason: text('purpose_reason'),
  ownershipReflection: text('ownership_reflection'),
  evidenceOfProgress: text('evidence_of_progress'),
  controlNotes: text('control_notes'),
  tradeoffs: text('tradeoffs'),
  capacityNotes: text('capacity_notes'),
  tags: jsonb('tags').default([]),
  goalType: text('goal_type').notNull().default('outcome'), // 'outcome' | 'ongoing_direction'
  status: text('status').notNull().default('candidate'), // 'candidate' | 'active' | 'paused' | 'completed' | 'archived'
  targetDate: text('target_date'), // YYYY-MM-DD optional
  reviewDate: text('review_date'), // YYYY-MM-DD
  reviewCadence: text('review_cadence').default('weekly'), // 'weekly' | 'biweekly' | 'monthly'
  originInboxItemId: text('origin_inbox_item_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Projects (Bounded multi-step work distinct from milestones)
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  goalId: text('goal_id'),
  lifeAreaId: text('life_area_id'),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'completed' | 'archived'
  originInboxItemId: text('origin_inbox_item_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 8. Milestones (Checkpoints within a Goal)
export const milestones = pgTable('milestones', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  goalId: text('goal_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'), // 'todo' | 'doing' | 'done' | 'dropped'
  seq: integer('seq').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 9. Tasks / Next Actions
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  goalId: text('goal_id'),
  milestoneId: text('milestone_id'),
  projectId: text('project_id'),
  parentTaskId: text('parent_task_id'),
  originInboxItemId: text('origin_inbox_item_id'),
  title: text('title').notNull(),
  nextAction: text('next_action'),
  status: text('status').notNull().default('todo'), // 'todo' | 'doing' | 'done' | 'paused' | 'cancelled'
  estMinutes: integer('est_minutes'),
  dueDate: text('due_date'), // YYYY-MM-DD
  scheduledDate: text('scheduled_date'), // YYYY-MM-DD
  rescheduleCount: integer('reschedule_count').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Day Plans (Today's context: duty time, off day, minimum day, main priority)
export const dayPlans = pgTable('day_plans', {
  id: text('id').primaryKey(), // `${userId}_${planDate}`
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  planDate: text('plan_date').notNull(), // YYYY-MM-DD
  isOff: boolean('is_off').notNull().default(false),
  dutyStart: text('duty_start'), // HH:MM
  minimumDay: boolean('minimum_day').notNull().default(false),
  mainTaskId: text('main_task_id'),
  locked: boolean('locked').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 11. Routines / Habit Systems
export const routines = pgTable('routines', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  goalId: text('goal_id'),
  originInboxItemId: text('origin_inbox_item_id'),
  title: text('title').notNull(),
  block: text('block').notNull().default('anytime'), // 'morning' | 'duty' | 'evening' | 'anytime'
  anchorType: text('anchor_type').notNull().default('clock'), // 'clock' | 'wake' | 'duty_start'
  clockTime: text('clock_time'), // HH:MM
  anchorOffsetMin: integer('anchor_offset_min').notNull().default(0),
  appliesOn: text('applies_on').notNull().default('all'), // 'all' | 'duty_days' | 'off_days'
  daysOfWeek: jsonb('days_of_week').notNull().default([1, 2, 3, 4, 5, 6, 7]),
  isMust: boolean('is_must').notNull().default(false),
  targetValue: integer('target_value'), // e.g., 2500 for water
  stepValue: integer('step_value'), // e.g., 250 for water
  unit: text('unit'), // e.g., 'ml'
  checkpoints: jsonb('checkpoints'), // [{"at":"11:00","min":750},...]
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 12. Routine Logs (Per-day tracking)
export const routineLogs = pgTable('routine_logs', {
  id: text('id').primaryKey(), // `${routineId}_${logDate}`
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  routineId: text('routine_id').notNull(),
  logDate: text('log_date').notNull(), // YYYY-MM-DD
  status: text('status').notNull().default('partial'), // 'partial' | 'done' | 'skipped'
  value: integer('value').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 13. Daily Reviews
export const dailyReviews = pgTable('daily_reviews', {
  id: text('id').primaryKey(), // `${userId}_${reviewDate}`
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  reviewDate: text('review_date').notNull(),
  completedText: text('completed_text'),
  pendingText: text('pending_text'),
  surpriseText: text('surprise_text'),
  changeTomorrow: text('change_tomorrow'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Weekly Reviews
export const weeklyReviews = pgTable('weekly_reviews', {
  id: text('id').primaryKey(), // `${userId}_${weekStart}`
  userId: text('user_id')
    .notNull()
    .references(() => users.uid, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(),
  accomplishments: text('accomplishments'),
  challenges: text('challenges'),
  decisions: text('decisions'),
  nextPriorities: text('next_priorities'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 15. Reminder Dedupe Log & Push Subscriptions
export const reminderSent = pgTable(
  'reminder_sent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    logDate: text('log_date').notNull(),
    itemKey: text('item_key').notNull(),
    nudgeNo: integer('nudge_no').notNull().default(0),
    batchId: text('batch_id').notNull(),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('reminder_sent_user_date_item_nudge_uidx').on(
      table.userId,
      table.logDate,
      table.itemKey,
      table.nudgeNo
    ),
  ]
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastOkAt: timestamp('last_ok_at'),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_uidx').on(table.endpoint),
  ]
);

// 16. Per-User Daily AI Usage Cap Table
export const aiUsage = pgTable(
  'ai_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    day: text('day').notNull(), // YYYY-MM-DD
    count: integer('count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })]
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  lifeAreas: many(lifeAreas),
  inboxItems: many(inboxItems),
  goals: many(goals),
  projects: many(projects),
  milestones: many(milestones),
  tasks: many(tasks),
  routines: many(routines),
  aiUsage: many(aiUsage),
}));

