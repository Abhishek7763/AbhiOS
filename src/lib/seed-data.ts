import { AppStateData } from './types';
import { addDays, todayLocal } from './logic/dates';

/**
 * Generates a deterministic 8-character hex suffix from a userId so that
 * seeded records for different authenticated users never collide on primary keys,
 * while keeping 'local-user' IDs unprefixed for local/offline mode and existing tests.
 */
export function hashUserIdSuffix(userId: string): string {
  let h1 = 0xdeadbeef ^ userId.length;
  let h2 = 0x41c6ce57 ^ userId.length;
  for (let i = 0; i < userId.length; i++) {
    const ch = userId.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return combined.toString(16).slice(-8).padStart(8, '0');
}

export function scopeSeedId(baseId: string, userId: string): string {
  if (!userId || userId === 'local-user') {
    return baseId;
  }
  return `${baseId}-${hashUserIdSuffix(userId)}`;
}

export function createInitialSeedData(
  userId: string = 'local-user'
): AppStateData {
  const today = todayLocal('Asia/Kolkata', 4);
  const nowIso = new Date().toISOString();
  const threeDaysAgoIso = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000
  ).toISOString();
  const sid = (baseId: string) => scopeSeedId(baseId, userId);

  return {
    settings: {
      userId,
      timezone: 'Asia/Kolkata',
      wakeTime: '06:30',
      quietStart: '23:00',
      quietEnd: '06:00',
      dayRolloverHour: 4,
      dailyWorkloadMinutes: 120,
      dutyPromptTime: '06:45',
      reviewTime: '21:30',
      maxRemindersPerDay: 8,
      pushEnabled: true,
      lastActiveDate: today,
    },
    lifeAreas: [
      {
        id: sid('area-health'),
        userId,
        name: 'Health',
        description: 'Daily stamina, sleep, paani aur physical fitness',
        status: 'active',
        sortOrder: 1,
      },
      {
        id: sid('area-finance'),
        userId,
        name: 'Finance',
        description: 'Emergency fund, bachat aur financial stability',
        status: 'active',
        sortOrder: 2,
      },
      {
        id: sid('area-relationships'),
        userId,
        name: 'Relationship',
        description: 'Parivaar, close relationships, bharosa aur quality time',
        status: 'active',
        sortOrder: 3,
      },
      {
        id: sid('area-duty'),
        userId,
        name: 'Career & Duty',
        description: 'Duty punctuality, skill building aur professional kaam',
        status: 'active',
        sortOrder: 4,
      },
      {
        id: sid('area-personal'),
        userId,
        name: 'Personal & Peace',
        description: 'Ghar ke kaam, learning aur mental peace',
        status: 'active',
        sortOrder: 5,
      },
    ],
    inboxItems: [
      {
        id: sid('inb-1'),
        userId,
        content:
          'Har mahine ₹5,000 emergency fund me alag rakhna shuru karna hai taaki 6 month ka buffer ban sake',
        status: 'new',
        itemType: 'unknown',
        source: 'quick_capture',
        lifeAreaId: sid('area-finance'),
        tags: ['#finance', '#daily-system'],
        createdAt: threeDaysAgoIso,
        updatedAt: threeDaysAgoIso,
      },
      {
        id: sid('inb-2'),
        userId,
        content:
          'Bike servicing karwani hai aur engine oil check karwana hai',
        status: 'new',
        itemType: 'unknown',
        source: 'quick_capture',
        lifeAreaId: sid('area-personal'),
        tags: ['#finance'],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('inb-3'),
        userId,
        content:
          'Duty shift ke baad 20 minute bina phone ke walk karne ka experiment',
        status: 'new',
        itemType: 'idea',
        source: 'manual',
        lifeAreaId: sid('area-health'),
        tags: ['#health', '#peace'],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('inb-4'),
        userId,
        content: 'Home gym setup ya resistance bands lene ka vichaar',
        status: 'new',
        itemType: 'unknown',
        source: 'manual',
        lifeAreaId: sid('area-health'),
        tags: ['#health'],
        decisionNote: 'Soch-vichar me rakha gaya thought',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    inboxLinks: [],
    goals: [
      {
        id: sid('goal-1'),
        userId,
        lifeAreaId: sid('area-health'),
        title: 'Duty ke saath consistent energy aur 2.5L hydration system',
        desiredOutcome:
          'Roz bina thakan ke duty poori karna, 2500ml paani aur subah time se uthna',
        purposeReason:
          'Jab subah hadbadi hoti hai aur paani kam rehta hai to poore din headache aur thakan rehti hai.',
        ownershipReflection:
          '100% meri apni zarurat hai, kisi doosre ko dikhane ke liye nahi.',
        evidenceOfProgress:
          'Hafte me 5+ din ready-for-duty time par hona aur sham tak 2.5L paani poora hona.',
        controlNotes: 'Sone ka time aur bottle saath rakhna mere haath me hai.',
        tradeoffs: 'Raat ko 10:45 ke baad scrolling band karni hogi.',
        capacityNotes: 'Subah uthte hi 500ml paani peena.',
        tags: ['#health', '#daily-system'],
        goalType: 'ongoing_direction',
        status: 'active',
        targetDate: null,
        reviewDate: addDays(today, 5),
        reviewCadence: 'weekly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-health-2'),
        userId,
        lifeAreaId: sid('area-health'),
        title: 'Roz 30 minute Morning Walk aur Clean Home Diet',
        desiredOutcome: 'Stamina badhana aur weight fit rakhna',
        purposeReason: 'Long-term sehat aur active life ke liye.',
        ownershipReflection: 'Khud ki fitness ke liye.',
        evidenceOfProgress: 'Hafte me 5 din walk poori hona.',
        controlNotes: 'Subah 20 min pehle uthna.',
        tradeoffs: 'Bahar ka junk food kam karna.',
        capacityNotes: 'Shoes raat ko hi darwaze ke paas rakhna.',
        tags: ['#health'],
        goalType: 'outcome',
        status: 'active',
        targetDate: addDays(today, 90),
        reviewDate: addDays(today, 7),
        reviewCadence: 'weekly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-fin-sys'),
        userId,
        lifeAreaId: sid('area-finance'),
        title: 'Har mahine mindful spending aur fixed 20% auto-savings system',
        desiredOutcome:
          'Har mahine salary aate hi pehle bachat alag ho aur bina hisaab ke kharch na ho',
        purposeReason:
          'Financial discipline hamesha chalne wala system hai jo long-term freedom deta hai.',
        ownershipReflection: 'Khud ki financial shanti ke liye.',
        evidenceOfProgress: 'Mahine ke ant me budget ke andar rehna.',
        controlNotes: 'Impulse shopping rokna mere control me hai.',
        tradeoffs:
          'Koi bhi ₹1,000+ ka gair-zaruri saman lene se pehle 24 ghante rukna.',
        capacityNotes: 'Har Sunday 5 minute kharch check karna.',
        tags: ['#finance', '#daily-system', '#peace'],
        goalType: 'ongoing_direction',
        status: 'active',
        targetDate: null,
        reviewDate: addDays(today, 14),
        reviewCadence: 'monthly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-rel-1'),
        userId,
        lifeAreaId: sid('area-relationships'),
        title: 'Family ke saath roz 20 min bina phone ke quality baat-cheet',
        desiredOutcome:
          'Ghar walo aur apne close rishton me hamesha bharosa, samajh aur apnapan bana rahe',
        purposeReason:
          'Duty ki bhaag-daud me rishton ko waqt dena sabse zyada mental sukoon deta hai.',
        ownershipReflection: 'Meri apni family priority hai.',
        evidenceOfProgress:
          'Roz sham ko khane ke waqt phone side rakh kar parivaar ke saath baithna.',
        controlNotes:
          'Apna phone silent rakhna aur dhyan se sunna mere haath me hai.',
        tradeoffs: 'Khane ke waqt reels/news dekhna band karna hoga.',
        capacityNotes:
          'Roz 15-20 minute dinner table par bina phone ke baat karna.',
        tags: ['#relationship', '#family', '#daily-system'],
        goalType: 'ongoing_direction',
        status: 'active',
        targetDate: null,
        reviewDate: addDays(today, 7),
        reviewCadence: 'weekly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-rel-2'),
        userId,
        lifeAreaId: sid('area-relationships'),
        title: 'Parents aur close doston ka har hafte haal-chaal lena',
        desiredOutcome: 'Rishton me doori na aaye aur sabse judaav bana rahe',
        purposeReason: 'Apno ka saath zindagi ki sabse badi taqat hai.',
        ownershipReflection: 'Apni khushi se.',
        evidenceOfProgress: 'Har Sunday ek lamba call ya mulaqat.',
        controlNotes: 'Sunday sham ko 30 min fix rakhna.',
        tradeoffs: 'Social media time kam karna.',
        capacityNotes: 'Sunday ko phone call reminder.',
        tags: ['#relationship', '#family'],
        goalType: 'ongoing_direction',
        status: 'active',
        targetDate: null,
        reviewDate: addDays(today, 7),
        reviewCadence: 'weekly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-duty-1'),
        userId,
        lifeAreaId: sid('area-duty'),
        title: 'Duty par hamesha 15 minute pehle pahunchna aur zero-stress shift',
        desiredOutcome: 'Bina hadbadi ke har shift shuru aur khatam karna',
        purposeReason: 'Kaam me sukoon aur izzat dono bani rehti hai.',
        ownershipReflection: 'Apne career aur peace ke liye.',
        evidenceOfProgress: 'Roz duty bag raat ko hi taiyar hona.',
        controlNotes: 'Raat ki taiyari mere haath me hai.',
        tradeoffs: 'Subah late uthne ki aadat chhodna.',
        capacityNotes: 'Duty start se 45 min pehle ready hona.',
        tags: ['#duty-career', '#daily-system'],
        goalType: 'ongoing_direction',
        status: 'active',
        targetDate: null,
        reviewDate: addDays(today, 7),
        reviewCadence: 'weekly',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('goal-cand-1'),
        userId,
        lifeAreaId: sid('area-finance'),
        title: '6-Month Emergency Fund (₹1.5 Lakh) banana',
        desiredOutcome:
          'Alag liquid account me ₹1,50,000 ka untouched emergency buffer.',
        purposeReason:
          'Kisi bhi unexpected medical ya family zarurat me bina udhaar liye shanti rahe.',
        ownershipReflection: 'Apni aur family ki mental security ke liye.',
        evidenceOfProgress: 'Har mahine salary ke agle din auto-transfer.',
        controlNotes: 'Monthly bachat mere control me hai.',
        tradeoffs:
          'Gair-zaruri online shopping aur bahar ka khana kam karna padega.',
        capacityNotes:
          'Pichle 2 mahine ka bank statement dekh kar fixed amount tay karna.',
        tags: ['#finance', '#peace'],
        goalType: 'outcome',
        status: 'candidate',
        targetDate: addDays(today, 180),
        reviewDate: addDays(today, 7),
        reviewCadence: 'monthly',
        originInboxItemId: sid('inb-1'),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    projects: [
      {
        id: sid('proj-1'),
        userId,
        goalId: sid('goal-1'),
        lifeAreaId: sid('area-health'),
        title: 'Morning & Duty-Ready Setup',
        description: 'Duty bag, bottle aur kapde raat ko hi set karne ka system',
        status: 'active',
        originInboxItemId: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    milestones: [
      {
        id: sid('ms-1'),
        userId,
        goalId: sid('goal-1'),
        title: '1L Insulated Water Bottle duty bag me permanent rakhna',
        description: 'Taaki duty par paani napna aasan rahe',
        status: 'done',
        seq: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('ms-2'),
        userId,
        goalId: sid('goal-1'),
        title: 'Lagataar 2 hafte 11:00 PM quiet-hours follow karna',
        description: 'Neend poori hogi tabhi 06:30 wake time chalega',
        status: 'doing',
        seq: 2,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    tasks: [
      {
        id: sid('task-1'),
        userId,
        goalId: sid('goal-1'),
        milestoneId: sid('ms-2'),
        projectId: sid('proj-1'),
        title:
          'Raat 10:30 PM ka phone wind-down alarm aur DND schedule set karo',
        nextAction: 'Phone Clock app khol kar 22:30 Bedtime mode ON karo',
        status: 'todo',
        estMinutes: 15,
        dueDate: today,
        scheduledDate: today,
        rescheduleCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('task-2'),
        userId,
        goalId: null,
        milestoneId: null,
        projectId: null,
        title: 'Electricity bill aur WiFi recharge pay karna',
        nextAction: 'UPI app khol kar dono bill clear karo',
        status: 'todo',
        estMinutes: 10,
        dueDate: today,
        scheduledDate: today,
        rescheduleCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('task-3'),
        userId,
        goalId: sid('goal-1'),
        milestoneId: null,
        projectId: sid('proj-1'),
        title: 'Duty bag me extra ORS packets aur chhota notebook rakhna',
        nextAction:
          'Medical box se 2 ORS packet nikal kar bag ki front pocket me rakho',
        status: 'todo',
        estMinutes: 20,
        dueDate: addDays(today, 1),
        scheduledDate: addDays(today, 1),
        rescheduleCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: sid('task-4'),
        userId,
        goalId: null,
        milestoneId: null,
        projectId: null,
        title: 'Purani almari ke documents sort karna',
        nextAction: 'Sirf sabse upar wale shelf ki 1 file check karo',
        status: 'todo',
        estMinutes: 45,
        dueDate: addDays(today, -2),
        scheduledDate: addDays(today, -2),
        rescheduleCount: 3,
        createdAt: threeDaysAgoIso,
        updatedAt: nowIso,
      },
    ],
    dayPlans: [
      {
        id: `${userId}_${today}`,
        userId,
        planDate: today,
        isOff: false,
        dutyStart: '08:30',
        minimumDay: false,
        mainTaskId: sid('task-1'),
        locked: false,
      },
    ],
    routines: [
      {
        id: sid('rt-brush'),
        userId,
        title: 'Brush & Fresh Hona',
        block: 'morning',
        anchorType: 'wake',
        clockTime: null,
        anchorOffsetMin: 15, // 06:45
        appliesOn: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        isMust: true,
        active: true,
        sortOrder: 1,
      },
      {
        id: sid('rt-bath'),
        userId,
        title: 'Nahana (Bath)',
        block: 'morning',
        anchorType: 'wake',
        clockTime: null,
        anchorOffsetMin: 35, // 07:05
        appliesOn: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        isMust: true,
        active: true,
        sortOrder: 2,
      },
      {
        id: sid('rt-ready-duty'),
        userId,
        title: 'Ready for Duty (Uniform + Bag Check)',
        block: 'duty',
        anchorType: 'duty_start',
        clockTime: null,
        anchorOffsetMin: -45, // 45 mins before dutyStart
        appliesOn: 'duty_days',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        isMust: true,
        active: true,
        sortOrder: 3,
      },
      {
        id: sid('rt-water'),
        userId,
        goalId: sid('goal-1'),
        title: 'Paani (2500 ml Daily Target)',
        block: 'anytime',
        anchorType: 'clock',
        clockTime: '08:00',
        anchorOffsetMin: 0,
        appliesOn: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        isMust: true,
        targetValue: 2500,
        stepValue: 250,
        unit: 'ml',
        checkpoints: [
          { at: '11:00', min: 750 },
          { at: '14:00', min: 1500 },
          { at: '18:00', min: 2000 },
        ],
        active: true,
        sortOrder: 4,
      },
      {
        id: sid('rt-walk'),
        userId,
        goalId: sid('goal-1'),
        title: '20 Min Evening Walk / Stretch',
        block: 'evening',
        anchorType: 'clock',
        clockTime: '19:30',
        anchorOffsetMin: 0,
        appliesOn: 'all',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        isMust: false,
        active: true,
        sortOrder: 5,
      },
    ],
    routineLogs: [
      {
        id: `${sid('rt-water')}_${today}`,
        userId,
        routineId: sid('rt-water'),
        logDate: today,
        status: 'partial',
        value: 750,
        completedAt: null,
      },
    ],
    dailyReviews: [],
    weeklyReviews: [],
    reminderSent: [],
  };
}
