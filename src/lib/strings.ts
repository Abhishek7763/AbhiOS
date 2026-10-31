import { InboxItemType } from './types';

export const STRINGS = {
  appName: 'AbhiOS',
  appSubtitle: 'Brain Dump First · Quality-Gated Goals · Daily Execution',
  nav: {
    today: 'Aaj',
    inbox: 'Brain Dump',
    tasks: 'Tasks',
    goals: 'Goals',
    settings: 'Settings',
  },
  quickCapture: {
    button: '+ Brain Dump',
    placeholder:
      'Koi bhi thought, idea, kaam, chinta ya wish likho... (Save first, organize later)',
    saveBtn: 'Inbox Me Save Karo',
    savedToast: 'Brain Dump me save ho gaya — koi obligation nahi.',
    helper: '5-second capture: Abhi category, date ya goal chunne ki zarurat nahi hai.',
  },
  inbox: {
    title: 'Universal Brain Dump & Triage',
    subtitle: 'Har thought commitment nahi hota. Jab waqt mile tab ek-ek karke clarify karo.',
    tabs: {
      unprocessed: 'Unprocessed',
      waiting: 'Waiting',
      someday: 'Someday / Maybe',
      processed: 'Processed / Archived',
      trash: 'Trash',
    },
    oldItemsInfo: (count: number) =>
      `${count} thoughts 2 din se purane hain (jab mann ho tab clarify karein).`,
    actions: {
      clarify: 'Clarify & Decide',
      split: 'Split (Alag Karo)',
      merge: 'Merge Duplicate',
      defer: 'Abhi Nahi (Not Sure Yet)',
      someday: 'Someday / Maybe',
      archive: 'Keep as Reference',
      trash: 'Trash',
      restore: 'Wapas Lao (Undo)',
      aiSuggest: 'AI Sujhaav Lo',
    },
    aiDraftBadge: 'AI Draft — Aap edit ya accept karein',
    aiFallbackNotice: (reason: string) =>
      reason === 'quota'
        ? 'Aaj ki AI daily limit poori ho gayi — rule-based draft taiyar hai.'
        : reason === 'timeout'
          ? 'AI response timeout hua — rule-based draft dikhaya ja raha hai.'
          : 'AI abhi uplabdh nahi hai — rule-based draft taiyar hai.',
  },
  auth: {
    noAccessTitle: 'Is account ko access nahi hai',
    noAccessSubtitle:
      'Ye AbhiOS private hai aur sirf authorized owner email ke liye allowed hai.',
    logoutBtn: 'Log Out Karein',
  },
  itemTypes: {
    unknown: { label: 'Undecided / Raw Thought', desc: 'Abhi tay nahi kiya hai' },
    task: {
      label: 'A. Next Action / Task',
      desc: 'Ek specific kaam jo aap seedha shuru kar sakte ho',
    },
    goal_candidate: {
      label: 'B. Goal Candidate (Quality Gate)',
      desc: 'Ek bada outcome jiske liye Quality Gate review zaruri hai',
    },
    project: {
      label: 'C. Project (Multi-step Work)',
      desc: 'Multiple steps wala kaam jiska ek finish line hai',
    },
    habit_candidate: {
      label: 'D. Routine / Habit Candidate',
      desc: 'Roz ya bar-bar karne wala repeatable process',
    },
    reference: {
      label: 'E. Reference / Knowledge',
      desc: 'Sirf yaad rakhne ki jaankari, koi action nahi',
    },
    idea: {
      label: 'F. Idea / Experiment',
      desc: 'Bina commitment ke explore karne wala vichaar',
    },
    someday: {
      label: 'G. Someday / Maybe',
      desc: 'Achha vichaar hai par abhi active nahi karna',
    },
    concern: {
      label: 'H. Concern / Question',
      desc: 'Koi sawaal ya uljhan jise samajhna ya suljhana hai',
    },
    waiting_for: {
      label: 'I. Waiting For / Delegated',
      desc: 'Kisi aur vyakti ya event par nirbhar',
    },
    duplicate: {
      label: 'J. Trash / Duplicate',
      desc: 'Bekaar ya repeat item (confirm karke hatayein)',
    },
  } as Record<InboxItemType | 'someday', { label: string; desc: string }>,
  qualityGate: {
    title: 'Goal Quality Gate — Kya Ye Asli Goal Hai?',
    subtitle:
      'Har wish active goal nahi banti. Trade-offs aur personal reason samajh kar hi commitment lein.',
    sleepOnItBanner:
      'Sujhaav: Ye ek bada ya mehnga goal lag raha hai. Chahein to aaj Candidate rehne dein aur kal phir dekhein (Sleep on it).',
    activeCapWarning: (count: number) =>
      `Abhi aapke ${count} Active Goals chal rahe hain (advisory: 5 se zyada hone par focus bikharta hai). Kisi ko pause ya Someday me rakhne par vichaar karein.`,
    questions: {
      q1_outcome: '1. Desired Outcome: Aap kya alag ya sach hote dekhna chahte hain?',
      q2_reason: '2. Personal Reason: Ye aapke liye personally kyun zaruri hai?',
      q3_ownership:
        '3. Ownership Check: Kya ye aapki apni chahat hai, ya comparison / FOMO / doosron ka pressure?',
      q4_evidence: '4. Evidence: Progress ya completion kaise pehchanoge? (Optional)',
      q5_control: '5. Control Boundary: Kitna aapke haath me hai aur kya doosron par nirbhar hai?',
      q6_tradeoffs:
        '6. Cost & Trade-offs: Isme kitna time, paisa, ya energy lagegi? Iske liye kya kam ya pause karna padega?',
      q7_capacity: '7. Capacity & First Step: Sabse chhota realistic Next Action kya hai?',
      q8_horizon: '8. Horizon: Kya ye time-bound outcome hai ya ongoing direction/system?',
      q9_check:
        '9. Classification Check: Kya ye sach me Goal hai, ya sirf ek Project, single Task, ya Habit?',
    },
    outcomes: {
      accept: 'Accept as Active Goal (Commitment Lein)',
      refine: 'Abhi Candidate Rakho (Refine / Sleep on It)',
      convertProject: 'Project Me Badlo',
      convertTask: 'Single Task Banao',
      convertHabit: 'Routine / Habit Banao',
      someday: 'Someday / Maybe Me Rakho',
      reference: 'Keep as Idea / Reference',
      decline: 'Decline / Archive Karo',
    },
  },
  today: {
    dutyLabel: 'Duty Start',
    offDayLabel: 'Off Day',
    minimumDayLabel: 'Minimum Day',
    minimumDayDesc: 'Sirf zaruri (Must) routines + 1 Main Priority dikh rahi hai.',
    needsAttention: 'Dhyan Dein (Needs Attention)',
    mainPriority: 'Aaj Ki Main Priority',
    choosePriority: 'Priority Chuno',
    suggestPriority: 'Best Suggest Karo',
    waterTitle: 'Paani (Hydration Tracker)',
    routinesTitle: 'Aaj Ke Routines',
    tasksTitle: 'Aaj Ke Tasks',
    dailyReviewBtn: 'Daily Review Karo (2 Min Close-Out)',
    weeklyReviewBtn: 'Weekly Review',
    reEntryTitle: 'Wapas swagat hai. Aaj se fresh start.',
    reEntrySubtitle:
      'Kuch din gap raha — koi baat nahi, koi streak loss nahi. Purane atke tasks ko 1-click me halka karein.',
    reEntryCleanBtn: (count: number) =>
      `Purane Overdue Tasks (${count}) Ko Unschedule / Pause Karo`,
    taskQualityHint: 'Kya tum bina aur planning ke ye shuru kar sakte ho?',
    rescheduleWarning: 'Ye task 3+ baar reschedule ho chuka hai — ise Chhota Karo (Split) ya Cancel karein?',
  },
  reviews: {
    dailyTitle: 'Daily Review — Aaj Ka Close-Out',
    weeklyTitle: 'Weekly Review — Plan vs Asli Zindagi',
    pendingActions: {
      tomorrow: 'Baad Me (Kal)',
      reschedule: 'Date Chuno',
      split: 'Chhota Karo (Split)',
      cancel: 'Cancel Karo',
    },
  },
  reminders: {
    title: 'Reminders',
    enableBtn: 'Enable Notifications',
    disableBtn: 'Disable Notifications',
    testBtn: 'Test Notification',
    statusLabel: 'Push Status',
    status: {
      unsupported: 'Unsupported (Is browser me Web Push uplabdh nahi hai)',
      denied: 'Denied (Browser site settings me Notifications Allow karein)',
      enabled: 'Enabled (Android Web Push Active)',
      disabled: 'Disabled (Reminders Band Hain)',
    },
    batteryHelp:
      'Reminders time par aayein iske liye: Android Settings -> Apps -> Chrome ko Battery: Unrestricted karo.',
    signInRequired:
      'Push notifications enable ya test karne ke liye pehle Google Sign-In karein.',
    missingVapidKey:
      'Server par NEXT_PUBLIC_VAPID_PUBLIC_KEY set nahi hai.',
    enabledToast: 'Push reminders enable ho gaye!',
    disabledToast: 'Push reminders disable ho gaye.',
    testSentToast: 'Test notification bhej diya gaya!',
    testFailToast: 'Test notification fail hua — pehle Enable karein.',
  },
  sync: {
    conflictToast: 'Doosre device ka naya change mila',
    pendingLabel: (count: number) => `pending ${count}`,
    goalDeletedToast: 'Goal delete kar diya gaya.',
    deleteGoalBtn: 'Goal Delete Karo',
  },
  pwa: {
    updateAvailable: 'Naya version aaya — refresh karein',
    refreshBtn: 'Refresh',
    offlineTitle: 'Aap Offline Hain',
    offlineDesc:
      'Internet connection band hai ya phone airplane mode me hai. Aapka AbhiOS local data cache me surakshit hai.',
    offlineTip:
      'Puraani planning aur Today execution bina internet ke bhi chalti rahegi. Naye badlav internet aate hi automatic sync honge.',
    retryBtn: 'Dobara Koshish Karein',
    openAppBtn: 'Wapas App Kholein',
    sharedCaptureToast: 'Shared content Brain Dump me taiyaar hai — review karke save karein.',
  },
  roster: {
    sheetTitle: 'Is Hafte Ka Duty Roster',
    sheetSubtitle: 'Agle 7 din ki duty timings ya chhutti ek hi baar me set karein.',
    openBtn: 'Is Hafte Ka Duty Roster',
    saveBtn: '7 Din Ka Roster Save Karo',
    savedToast: 'Is hafte ka duty roster save ho gaya!',
    dutyDay: 'Duty Day',
    offDay: 'Off Day (Chhutti)',
    customTime: 'Custom Time',
  },
  routineInsights: {
    title: 'Routine Insights (Calm Reflections)',
    subtitle:
      'Bina kisi streak ya guilt ke — roz ke routines ko aasaan banane ke sujhaav.',
    noDataNotice:
      'Abhi data kam hai — kuch din routine chalne ke baad aasan insights dikhenge.',
    applicableDone: (done: number, total: number) =>
      `${total} din me se ${done} din poora hua`,
    missedWindow: (block: string) => `Aksar miss hone wala window: ${block}`,
    suggestions: {
      morning_shift_30m:
        'Sujhaav: Is routine ka time 30 min aage ya pehle shift karke dekhein taaki aasaani ho.',
      duty_anchor_ready:
        'Sujhaav: Duty start hone se 90 min pehle anchor karein taaki aakhiri waqt par jaldbazi na ho.',
      evening_winddown:
        'Sujhaav: Sham ya raat ke routine ko bedtime se 45 min pehle schedule karein.',
      water_reduce_step:
        'Sujhaav: Paani ka step 200 ml ya chhota karke aasaani se poora karein.',
      simplify_or_reduce:
        'Sujhaav: Is routine ko thoda aasaan banayein ya review karke adjust karein.',
    },
  },
};

