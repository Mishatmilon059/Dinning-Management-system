import { isFirebaseEnabled, db } from "../firebase/config";
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  deleteDoc, query, orderBy, limit, startAfter 
} from "firebase/firestore";
import { authService } from "./authService";

// Interfaces
export interface ManagerProfile {
  id: string;
  name: string;
  dept: string;
  room: string;
  month: string;
  bio: string;
  photoUrl: string;
}

export interface TeamManagerInfo {
  name: string;
  id: string;
  room: string;
  dept: string;
  mobile: string;
  photoUrl?: string;
  bio?: string;
}

export interface ManagerTeam {
  teamName: string;
  passwordHash: string;
  managers: TeamManagerInfo[];
}

export interface GalleryItem {
  id: string;
  name: string;
  dept: string;
  batch: string;
  img: string;
  status?: "approved" | "pending";
}

export interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category: string;
}

export interface DayExpenses {
  date: string;
  items: ExpenseItem[];
  total: number;
  isLocked: boolean;
}

export interface MenuItem {
  lunch: string;
  dinner: string;
  estimatedCost?: number;
  lunchImages?: string[];
  dinnerImages?: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  usageRate: number; // units per day
  finishDate: string; // manual estimate
}

export interface Comment {
  id: string;
  text: string;
  name?: string;
  timestamp: number;
  highlighted: boolean;
}

export interface Notice {
  paymentDeadline: string;
  penaltyText: string;
}

export interface Contact {
  id: string;
  role: string;
  name: string;
  phone: string;
  introduction?: string;
}

export interface Complaint {
  id: string;
  category: string;
  date: string;
  severity: "low" | "medium" | "high";
  description: string;
  endorsingManagers: string[]; // List of manager IDs
  status: "draft" | "submitted";
}

export interface Broadcast {
  id: string;
  title: string;
  body: string;
  publishDate: string;
  expiryDate?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  actionType: string;
  details: string;
}

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: any;
  hasMore: boolean;
}

// Initial Mock Seed Data
const INITIAL_MANAGERS: Record<string, ManagerProfile> = {
  "2012001": {
    id: "2012001",
    name: "Sakib Al Hasan",
    dept: "CSE",
    room: "302",
    month: "May 2026",
    bio: "Passionate about streamlining processes. Let's make dining operations transparent and efficient!",
    photoUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop",
  },
  "2012002": {
    id: "2012002",
    name: "Tariqul Islam",
    dept: "EEE",
    room: "208",
    month: "May 2026",
    bio: "Avid cook and tech enthusiast. I look forward to managing the mess this month and hearing your feedback.",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
  },
  "2010045": {
    id: "2010045",
    name: "Naimur Rahman",
    dept: "ME",
    room: "415",
    month: "April 2026",
    bio: "Managed the mess in April. Focused on high protein diets and minimal wastage.",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
  }
};

const INITIAL_INVENTORY: InventoryItem[] = [
  { id: "1", name: "Rice (Miniket)", quantity: 150, unit: "kg", usageRate: 25, finishDate: "2026-06-01" },
  { id: "2", name: "Lentils (Dal)", quantity: 12, unit: "kg", usageRate: 3, finishDate: "2026-05-30" },
  { id: "3", name: "Soybean Oil", quantity: 8, unit: "litres", usageRate: 4, finishDate: "2026-05-28" },
  { id: "4", name: "Potatoes", quantity: 45, unit: "kg", usageRate: 15, finishDate: "2026-05-29" },
  { id: "5", name: "Chicken", quantity: 60, unit: "kg", usageRate: 35, finishDate: "2026-05-27" }
];

const INITIAL_CONTACTS: Contact[] = [
  { id: "1", role: "Provost", name: "Dr. Mohammad Ali", phone: "01711223344", introduction: "Available for general issues. Office hours: Sunday-Thursday 4pm-6pm." },
  { id: "2", role: "Assistant Provost", name: "Dr. S. M. Faruq", phone: "01822334455", introduction: "In-charge of Dining Mess Operations." },
  { id: "3", role: "Sick Boy / Medical Contact", name: "Milon Hossain", phone: "01933445566", introduction: "Contact for any medical emergencies or medicine collection." },
  { id: "4", role: "Electrician", name: "Subrata Kumar", phone: "01544556677", introduction: "Available 8am to 8pm for room electric repairs." },
  { id: "5", role: "Campus Security", name: "BUET Control Room", phone: "02-9665650", introduction: "Emergency campus-wide security hotline." }
];

const INITIAL_BROADCASTS: Broadcast[] = [
  {
    id: "1",
    title: "Mess Fee Submission Deadline Extended",
    body: "Please note that the mess fee submission deadline for May 2026 has been extended to May 28, 2026. Make sure to complete payments to avoid the 200 BDT penalty.",
    publishDate: "2026-05-20",
    expiryDate: "2026-05-29"
  },
  {
    id: "2",
    title: "Cleanliness Drive in Dining Hall",
    body: "There will be a deep cleaning drive in the dining hall and kitchen area this Friday from 8:00 AM to 12:00 PM. Dining services will remain suspended during these hours.",
    publishDate: "2026-05-25",
    expiryDate: "2026-05-29"
  }
];

const INITIAL_GALLERY_ITEMS: GalleryItem[] = [
  { id: "g1", name: "Md. Rajib Khan", dept: "CSE", batch: "2022", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { id: "g2", name: "Fatima Akter", dept: "EEE", batch: "2023", img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=80" },
  { id: "g3", name: "Ariful Islam", dept: "ME", batch: "2022", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80" },
  { id: "g4", name: "Rifa Akter", dept: "ChE", batch: "2024", img: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&q=80" },
  { id: "g5", name: "Tanvir Rahman", dept: "CE", batch: "2021", img: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=400&q=80" },
  { id: "g6", name: "Sajid Hasan", dept: "CSE", batch: "2023", img: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&q=80" }
];

// Seed Helper for Mock
const getMockData = <T>(key: string, initial: T): T => {
  const data = localStorage.getItem(`hmms_mock_${key}`);
  if (!data) {
    localStorage.setItem(`hmms_mock_${key}`, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
};

const saveMockData = (key: string, data: unknown) => {
  try {
    localStorage.setItem(`hmms_mock_${key}`, JSON.stringify(data));
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      throw new Error("Local storage quota exceeded! Cannot save data locally. Please clear browser storage or configure Firebase database.");
    }
    throw e;
  }
};

// Database Service Implementation
class DbService {
  // Caching layer properties (SCALE-02)
  private cache: Record<string, { data: any; timestamp: number }> = {};

  private getCached<T>(key: string, ttl = 60000): T | null {
    const cached = this.cache[key];
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache[key] = { data, timestamp: Date.now() };
  }

  private clearCache(keyPrefix: string): void {
    Object.keys(this.cache).forEach(k => {
      if (k.startsWith(keyPrefix)) {
        delete this.cache[k];
      }
    });
  }

  // Log Actions for audit trail (FEAT-02)
  async logAction(actionType: string, details: any): Promise<void> {
    const activeUser = authService.getCurrentUser();
    const resolvedUserId = activeUser?.id || "anonymous";
    const entry: AuditLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      userId: resolvedUserId,
      actionType,
      details: typeof details === "string" ? details : JSON.stringify(details)
    };

    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "audit_log", entry.id);
      await setDoc(docRef, entry);
    } else {
      const list = getMockData<AuditLogEntry[]>("audit_logs", []);
      list.unshift(entry);
      saveMockData("audit_logs", list);
    }
  }

  async getAuditLogs(): Promise<AuditLogEntry[]> {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "audit_log"), orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as AuditLogEntry);
    } else {
      return getMockData<AuditLogEntry[]>("audit_logs", []);
    }
  }

  // --- MANAGERS ---
  async getManagers(): Promise<ManagerProfile[]> {
    const cacheKey = "managers_list";
    const cached = this.getCached<ManagerProfile[]>(cacheKey);
    if (cached) return cached;

    let result: ManagerProfile[];
    if (isFirebaseEnabled && db) {
      const q = collection(db, "managers");
      const snap = await getDocs(q);
      result = snap.docs.map(d => d.data() as ManagerProfile);
    } else {
      const managers = getMockData("managers", INITIAL_MANAGERS);
      result = Object.values(managers);
    }
    this.setCache(cacheKey, result);
    return result;
  }

  async getManagerProfile(id: string): Promise<ManagerProfile | null> {
    const cacheKey = `manager_profile_${id}`;
    const cached = this.getCached<ManagerProfile>(cacheKey);
    if (cached) return cached;

    let result: ManagerProfile | null = null;
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "managers", id);
      const docSnap = await getDoc(docRef);
      result = docSnap.exists() ? (docSnap.data() as ManagerProfile) : null;
    } else {
      const managers = getMockData("managers", INITIAL_MANAGERS);
      result = managers[id] || null;
    }
    if (result) {
      this.setCache(cacheKey, result);
    }
    return result;
  }

  async updateManagerProfile(id: string, data: Partial<ManagerProfile>): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "managers", id);
      await setDoc(docRef, data, { merge: true });
    } else {
      const managers = getMockData("managers", INITIAL_MANAGERS);
      const existing = managers[id] || { id, name: "", dept: "", room: "", month: "", bio: "", photoUrl: "" };
      managers[id] = { ...existing, ...data };
      saveMockData("managers", managers);
    }
    this.clearCache("managers_list");
    this.clearCache(`manager_profile_${id}`);
    await this.logAction("UPDATE_PROFILE", { id, ...data });
  }

  // --- MANAGER TEAMS (V1) ---
  async getTeamProfile(teamName: string): Promise<ManagerTeam | null> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "teams", teamName.toLowerCase());
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as ManagerTeam) : null;
    } else {
      const teams = getMockData<Record<string, ManagerTeam>>("manager_teams", {});
      return teams[teamName.toLowerCase()] || null;
    }
  }

  async saveTeamProfile(teamName: string, teamData: ManagerTeam): Promise<void> {
    const key = teamName.toLowerCase();
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "teams", key);
      await setDoc(docRef, teamData);
      
      for (const mgr of teamData.managers) {
        const mgrRef = doc(db, "managers", mgr.id);
        await setDoc(mgrRef, {
          id: mgr.id,
          name: mgr.name,
          dept: mgr.dept,
          room: mgr.room,
          month: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          bio: mgr.bio || `Mess Manager for team ${teamData.teamName}`,
          photoUrl: mgr.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"
        });
      }
    } else {
      const teams = getMockData<Record<string, ManagerTeam>>("manager_teams", {});
      teams[key] = teamData;
      saveMockData("manager_teams", teams);

      const managers = getMockData<Record<string, ManagerProfile>>("managers", INITIAL_MANAGERS);
      const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      for (const mgr of teamData.managers) {
        managers[mgr.id] = {
          id: mgr.id,
          name: mgr.name,
          dept: mgr.dept,
          room: mgr.room,
          month: currentMonth,
          bio: mgr.bio || `Mess Manager for team ${teamData.teamName}`,
          photoUrl: mgr.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"
        };
      }
      saveMockData("managers", managers);
    }
    
    this.clearCache("managers_list");
    for (const mgr of teamData.managers) {
      this.clearCache(`manager_profile_${mgr.id}`);
    }
    await this.logAction("SAVE_TEAM_PROFILE", { teamName });
  }

  // --- CASH COLLECTION ---
  async getCashCollection(managerId: string): Promise<number> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "cashCollection", managerId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data().amount : 0;
    } else {
      const cash = getMockData("cashCollection", {} as Record<string, number>);
      return cash[managerId] || 0;
    }
  }

  async setCashCollection(managerId: string, amount: number): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "cashCollection", managerId);
      await setDoc(docRef, { amount });
    } else {
      const cash = getMockData("cashCollection", {} as Record<string, number>);
      cash[managerId] = amount;
      saveMockData("cashCollection", cash);
    }
    await this.logAction("SET_CASH", { managerId, amount });
  }

  // --- EXPENSES ---
  async getExpenses(managerId: string, date?: string): Promise<DayExpenses[]> {
    if (isFirebaseEnabled && db) {
      if (date) {
        const docRef = doc(db, "expenses", managerId, "days", date);
        const snap = await getDoc(docRef);
        return snap.exists() ? [snap.data() as DayExpenses] : [];
      } else {
        const q = collection(db, "expenses", managerId, "days");
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as DayExpenses);
      }
    } else {
      const key = `expenses_${managerId}`;
      const expenses = getMockData<Record<string, DayExpenses>>(key, {});
      if (date) {
        return expenses[date] ? [expenses[date]] : [];
      }
      return Object.values(expenses).sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // Cursor-based paginated past expenses (SCALE-01)
  async getExpensesPaginated(managerId: string, pageSize = 20, lastDocCursor: any = null): Promise<PaginatedResult<DayExpenses>> {
    if (isFirebaseEnabled && db) {
      let q = query(
        collection(db, "expenses", managerId, "days"),
        orderBy("date", "desc"),
        limit(pageSize)
      );
      if (lastDocCursor) {
        q = query(q, startAfter(lastDocCursor));
      }
      const snap = await getDocs(q);
      const items = snap.docs.map(d => d.data() as DayExpenses);
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      const hasMore = snap.docs.length === pageSize;
      return { items, lastDoc, hasMore };
    } else {
      const key = `expenses_${managerId}`;
      const expensesMap = getMockData<Record<string, DayExpenses>>(key, {});
      const sorted = Object.values(expensesMap).sort((a, b) => b.date.localeCompare(a.date));
      const startIndex = typeof lastDocCursor === "number" ? lastDocCursor : 0;
      const paginated = sorted.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < sorted.length;
      return {
        items: paginated,
        lastDoc: hasMore ? startIndex + pageSize : null,
        hasMore
      };
    }
  }

  async saveDayExpenses(managerId: string, date: string, items: ExpenseItem[], isLocked = false): Promise<void> {
    // Recompute totals inside the service layer (FUNC-02)
    const sanitizedItems = items.map(item => ({
      ...item,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100
    }));
    
    const total = sanitizedItems.reduce((sum, item) => sum + item.total, 0);
    const dayData: DayExpenses = { date, items: sanitizedItems, total, isLocked };

    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "expenses", managerId, "days", date);
      await setDoc(docRef, dayData);
    } else {
      const key = `expenses_${managerId}`;
      const expenses = getMockData<Record<string, DayExpenses>>(key, {});
      expenses[date] = dayData;
      saveMockData(key, expenses);
    }
    await this.logAction("SAVE_EXPENSES", { date, total, isLocked });
  }

  // --- MENU ---
  async getMenu(date: string): Promise<MenuItem | null> {
    const cacheKey = `menu_${date}`;
    const cached = this.getCached<MenuItem>(cacheKey);
    if (cached) return cached;

    let result: MenuItem | null = null;
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "menus", date);
      const snap = await getDoc(docRef);
      result = snap.exists() ? (snap.data() as MenuItem) : null;
    } else {
      const menus = getMockData<Record<string, MenuItem>>("menus", {
        "2026-05-26": { lunch: "Rice, Ruhi Fish Curry, Lentils, Salad", dinner: "Rice, Beef Bhuna, Potato Mash, Dal", estimatedCost: 150, lunchImages: [], dinnerImages: [] }
      });
      result = menus[date] || null;
    }
    if (result) {
      this.setCache(cacheKey, result);
    }
    return result;
  }

  async setMenu(date: string, menu: MenuItem): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "menus", date);
      await setDoc(docRef, menu);
    } else {
      const menus = getMockData<Record<string, MenuItem>>("menus", {});
      menus[date] = menu;
      saveMockData("menus", menus);
    }
    this.clearCache(`menu_${date}`);
    await this.logAction("SET_MENU", { date, menu });
  }

  // --- INVENTORY ---
  async getInventory(managerId: string): Promise<InventoryItem[]> {
    const cacheKey = `inventory_${managerId}`;
    const cached = this.getCached<InventoryItem[]>(cacheKey);
    if (cached) return cached;

    let result: InventoryItem[];
    if (isFirebaseEnabled && db) {
      const q = collection(db, "inventory", managerId, "items");
      const snap = await getDocs(q);
      result = snap.docs.map(d => d.data() as InventoryItem);
    } else {
      const key = `inventory_${managerId}`;
      result = getMockData<InventoryItem[]>(key, INITIAL_INVENTORY);
    }
    this.setCache(cacheKey, result);
    return result;
  }

  async updateInventoryItem(managerId: string, item: InventoryItem): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "inventory", managerId, "items", item.id);
      await setDoc(docRef, item);
    } else {
      const key = `inventory_${managerId}`;
      const inv = getMockData<InventoryItem[]>(key, INITIAL_INVENTORY);
      const index = inv.findIndex(i => i.id === item.id);
      if (index > -1) {
        inv[index] = item;
      } else {
        inv.push(item);
      }
      saveMockData(key, inv);
    }
    this.clearCache(`inventory_${managerId}`);
    await this.logAction("UPDATE_INVENTORY", item);
  }

  // --- FEEDBACK COMMENTS ---
  async getFeedback(date: string): Promise<Comment[]> {
    if (isFirebaseEnabled && db) {
      const q = collection(db, "feedback", date, "comments");
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Comment).sort((a, b) => b.timestamp - a.timestamp);
    } else {
      const key = `feedback_${date}`;
      return getMockData<Comment[]>(key, [
        { id: "1", text: "The beef bhuna was outstanding tonight!", name: "Anik", timestamp: Date.now() - 3600000, highlighted: true },
        { id: "2", text: "Fish was a bit cold, please serve it hot next time.", timestamp: Date.now() - 7200000, highlighted: false }
      ]);
    }
  }

  // Paginated feedback comments (SCALE-01)
  async getFeedbackPaginated(date: string, pageSize = 20, lastDocCursor: any = null): Promise<PaginatedResult<Comment>> {
    if (isFirebaseEnabled && db) {
      let q = query(
        collection(db, "feedback", date, "comments"),
        orderBy("timestamp", "desc"),
        limit(pageSize)
      );
      if (lastDocCursor) {
        q = query(q, startAfter(lastDocCursor));
      }
      const snap = await getDocs(q);
      const items = snap.docs.map(d => d.data() as Comment);
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      const hasMore = snap.docs.length === pageSize;
      return { items, lastDoc, hasMore };
    } else {
      const key = `feedback_${date}`;
      const allComments = getMockData<Comment[]>(key, []);
      const startIndex = typeof lastDocCursor === "number" ? lastDocCursor : 0;
      const paginated = allComments.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < allComments.length;
      return {
        items: paginated,
        lastDoc: hasMore ? startIndex + pageSize : null,
        hasMore
      };
    }
  }

  async addFeedback(date: string, text: string, name?: string): Promise<Comment> {
    const newComment: Comment = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      name: name || "Anonymous Student",
      timestamp: Date.now(),
      highlighted: false
    };

    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "feedback", date, "comments", newComment.id);
      await setDoc(docRef, newComment);
    } else {
      const key = `feedback_${date}`;
      const list = getMockData<Comment[]>(key, []);
      list.unshift(newComment);
      saveMockData(key, list);
    }
    return newComment;
  }

  async toggleFeedbackHighlight(date: string, commentId: string, highlighted: boolean): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "feedback", date, "comments", commentId);
      await updateDoc(docRef, { highlighted });
    } else {
      const key = `feedback_${date}`;
      const list = getMockData<Comment[]>(key, []);
      const item = list.find(c => c.id === commentId);
      if (item) {
        item.highlighted = highlighted;
        saveMockData(key, list);
      }
    }
    await this.logAction("MODERATE_FEEDBACK", { commentId, highlighted });
  }

  // --- REACTIONS ---
  async getReactions(date: string): Promise<Record<string, number>> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "reactions", date);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data() as Record<string, number> : { like: 0, love: 0, angry: 0 };
    } else {
      const key = `reactions_${date}`;
      return getMockData<Record<string, number>>(key, { like: 12, love: 8, angry: 2 });
    }
  }

  async hasVoted(date: string, userId: string): Promise<boolean> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "reactions", date, "voters", userId);
      const snap = await getDoc(docRef);
      return snap.exists();
    } else {
      const key = `voted_${date}_${userId}`;
      return localStorage.getItem(key) === "true";
    }
  }

  async addReaction(date: string, type: "like" | "love" | "angry", userId: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const voterDocRef = doc(db, "reactions", date, "voters", userId);
      const voterSnap = await getDoc(voterDocRef);
      if (voterSnap.exists()) {
        throw new Error("You have already voted today!");
      }
      
      const docRef = doc(db, "reactions", date);
      const snap = await getDoc(docRef);
      const data = snap.exists() ? snap.data() : { like: 0, love: 0, angry: 0 };
      data[type] = (data[type] || 0) + 1;
      
      await setDoc(docRef, data);
      await setDoc(voterDocRef, { type, timestamp: Date.now() });
    } else {
      const key = `voted_${date}_${userId}`;
      if (localStorage.getItem(key) === "true") {
        throw new Error("You have already voted today!");
      }
      
      const rKey = `reactions_${date}`;
      const data = getMockData<Record<string, number>>(rKey, { like: 0, love: 0, angry: 0 });
      data[type] = (data[type] || 0) + 1;
      saveMockData(rKey, data);
      
      localStorage.setItem(key, "true");
    }
  }

  // --- NOTICES & DEADLINES ---
  async getNotice(): Promise<Notice> {
    const cacheKey = "active_notice";
    const cached = this.getCached<Notice>(cacheKey);
    if (cached) return cached;

    let result: Notice;
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "notices", "active");
      const snap = await getDoc(docRef);
      result = snap.exists() ? (snap.data() as Notice) : { paymentDeadline: "", penaltyText: "" };
    } else {
      result = getMockData<Notice>("active_notice", {
        paymentDeadline: "2026-05-28T23:59:59",
        penaltyText: "A penalty fee of 200 BDT applies for payments made after the deadline."
      });
    }
    this.setCache(cacheKey, result);
    return result;
  }

  async setNotice(notice: Notice): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "notices", "active");
      await setDoc(docRef, notice);
    } else {
      saveMockData("active_notice", notice);
    }
    this.clearCache("active_notice");
    await this.logAction("SET_NOTICE", notice);
  }

  // --- CONTACTS ---
  async getContacts(): Promise<Contact[]> {
    const cacheKey = "contacts_list";
    const cached = this.getCached<Contact[]>(cacheKey);
    if (cached) return cached;

    let result: Contact[];
    if (isFirebaseEnabled && db) {
      const q = collection(db, "contacts");
      const snap = await getDocs(q);
      result = snap.docs.map(d => d.data() as Contact);
    } else {
      result = getMockData<Contact[]>("contacts", INITIAL_CONTACTS);
    }
    this.setCache(cacheKey, result);
    return result;
  }

  async saveContact(contact: Contact): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "contacts", contact.id);
      await setDoc(docRef, contact);
    } else {
      const list = getMockData<Contact[]>("contacts", INITIAL_CONTACTS);
      const index = list.findIndex(c => c.id === contact.id);
      if (index > -1) {
        list[index] = contact;
      } else {
        list.push(contact);
      }
      saveMockData("contacts", list);
    }
    this.clearCache("contacts_list");
    await this.logAction("SAVE_CONTACT", contact);
  }

  async deleteContact(id: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "contacts", id);
      await deleteDoc(docRef);
    } else {
      let list = getMockData<Contact[]>("contacts", INITIAL_CONTACTS);
      list = list.filter(c => c.id !== id);
      saveMockData("contacts", list);
    }
    this.clearCache("contacts_list");
    await this.logAction("DELETE_CONTACT", { id });
  }

  // --- COMPLAINTS ---
  async getComplaints(): Promise<Complaint[]> {
    if (isFirebaseEnabled && db) {
      const q = collection(db, "complaints");
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Complaint);
    } else {
      return getMockData<Complaint[]>("complaints", [
        { id: "1", category: "Water Supply", date: "2026-05-22", severity: "high", description: "Water filter in the dining hall is malfunctioning, forcing students to buy drinking water.", endorsingManagers: ["2012001"], status: "draft" }
      ]);
    }
  }

  async getComplaintsPaginated(pageSize = 20, lastDocCursor: any = null): Promise<PaginatedResult<Complaint>> {
    if (isFirebaseEnabled && db) {
      let q = query(
        collection(db, "complaints"),
        orderBy("date", "desc"),
        limit(pageSize)
      );
      if (lastDocCursor) {
        q = query(q, startAfter(lastDocCursor));
      }
      const snap = await getDocs(q);
      const items = snap.docs.map(d => d.data() as Complaint);
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      const hasMore = snap.docs.length === pageSize;
      return { items, lastDoc, hasMore };
    } else {
      const allComplaints = getMockData<Complaint[]>("complaints", []);
      const sorted = [...allComplaints].sort((a, b) => b.date.localeCompare(a.date));
      const startIndex = typeof lastDocCursor === "number" ? lastDocCursor : 0;
      const paginated = sorted.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < sorted.length;
      return {
        items: paginated,
        lastDoc: hasMore ? startIndex + pageSize : null,
        hasMore
      };
    }
  }

  async saveComplaint(complaint: Complaint): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "complaints", complaint.id);
      await setDoc(docRef, complaint);
    } else {
      const list = getMockData<Complaint[]>("complaints", []);
      const index = list.findIndex(c => c.id === complaint.id);
      if (index > -1) {
        list[index] = complaint;
      } else {
        list.push(complaint);
      }
      saveMockData("complaints", list);
    }
    await this.logAction("SAVE_COMPLAINT", complaint);
  }

  // --- BROADCASTS ---
  async getBroadcasts(): Promise<Broadcast[]> {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "broadcasts"), orderBy("publishDate", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as Broadcast);
    } else {
      return getMockData<Broadcast[]>("broadcasts", INITIAL_BROADCASTS);
    }
  }

  async getBroadcastsPaginated(pageSize = 20, lastDocCursor: any = null): Promise<PaginatedResult<Broadcast>> {
    if (isFirebaseEnabled && db) {
      let q = query(
        collection(db, "broadcasts"),
        orderBy("publishDate", "desc"),
        limit(pageSize)
      );
      if (lastDocCursor) {
        q = query(q, startAfter(lastDocCursor));
      }
      const snap = await getDocs(q);
      const items = snap.docs.map(d => d.data() as Broadcast);
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      const hasMore = snap.docs.length === pageSize;
      return { items, lastDoc, hasMore };
    } else {
      const allBroadcasts = getMockData<Broadcast[]>("broadcasts", INITIAL_BROADCASTS);
      const startIndex = typeof lastDocCursor === "number" ? lastDocCursor : 0;
      const paginated = allBroadcasts.slice(startIndex, startIndex + pageSize);
      const hasMore = startIndex + pageSize < allBroadcasts.length;
      return {
        items: paginated,
        lastDoc: hasMore ? startIndex + pageSize : null,
        hasMore
      };
    }
  }

  async addBroadcast(broadcast: Broadcast): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "broadcasts", broadcast.id);
      await setDoc(docRef, broadcast);
    } else {
      const list = getMockData<Broadcast[]>("broadcasts", INITIAL_BROADCASTS);
      list.unshift(broadcast);
      saveMockData("broadcasts", list);
    }
    await this.logAction("ADD_BROADCAST", broadcast);
  }

  async deleteBroadcast(id: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "broadcasts", id);
      await deleteDoc(docRef);
    } else {
      let list = getMockData<Broadcast[]>("broadcasts", INITIAL_BROADCASTS);
      list = list.filter(b => b.id !== id);
      saveMockData("broadcasts", list);
    }
    await this.logAction("DELETE_BROADCAST", { id });
  }

  // --- PAYMENTS (DATA-03) ---
  async getPayments(managerId: string): Promise<{ id: string; name: string; date: string }[]> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "payments", managerId);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data().paidStudentIds as { id: string; name: string; date: string }[]) : [];
    } else {
      return getMockData<{ id: string; name: string; date: string }[]>(`payments_${managerId}`, []);
    }
  }

  async savePayments(managerId: string, paidStudentIds: { id: string; name: string; date: string }[]): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "payments", managerId);
      await setDoc(docRef, { paidStudentIds });
    } else {
      saveMockData(`payments_${managerId}`, paidStudentIds);
    }
    await this.logAction("SAVE_PAYMENTS", { managerId, count: paidStudentIds.length });
  }

  // --- GALLERY ---
  async getGalleryItems(onlyApproved = false): Promise<GalleryItem[]> {
    const cacheKey = `gallery_list_${onlyApproved}`;
    const cached = this.getCached<GalleryItem[]>(cacheKey);
    if (cached) return cached;

    let result: GalleryItem[];
    if (isFirebaseEnabled && db) {
      const q = collection(db, "gallery");
      const snap = await getDocs(q);
      result = snap.docs.map(d => d.data() as GalleryItem);
    } else {
      result = getMockData<GalleryItem[]>("gallery", INITIAL_GALLERY_ITEMS);
    }

    result = result.map(item => ({ ...item, status: item.status || "approved" }));
    if (onlyApproved) {
      result = result.filter(item => item.status === "approved");
    }

    this.setCache(cacheKey, result);
    return result;
  }

  async saveGalleryItem(item: GalleryItem): Promise<void> {
    const itemWithStatus = { ...item, status: item.status || "approved" };
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "gallery", itemWithStatus.id);
      await setDoc(docRef, itemWithStatus);
    } else {
      const list = getMockData<GalleryItem[]>("gallery", INITIAL_GALLERY_ITEMS);
      const index = list.findIndex(g => g.id === itemWithStatus.id);
      if (index > -1) {
        list[index] = itemWithStatus;
      } else {
        list.push(itemWithStatus);
      }
      saveMockData("gallery", list);
    }
    this.clearCache("gallery_list_false");
    this.clearCache("gallery_list_true");
    await this.logAction("SAVE_GALLERY_ITEM", itemWithStatus);
  }

  async deleteGalleryItem(id: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "gallery", id);
      await deleteDoc(docRef);
    } else {
      let list = getMockData<GalleryItem[]>("gallery", INITIAL_GALLERY_ITEMS);
      list = list.filter(g => g.id !== id);
      saveMockData("gallery", list);
    }
    this.clearCache("gallery_list_false");
    this.clearCache("gallery_list_true");
    await this.logAction("DELETE_GALLERY_ITEM", { id });
  }
}

export const dbService = new DbService();
export default dbService;
