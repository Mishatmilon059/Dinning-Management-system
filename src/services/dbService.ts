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
  role?: string;
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

export interface ProvostProfile {
  name: string;
  dept: string;
  bio: string;
  photoUrl: string;
}

export interface Complaint {
  id: string;
  category: string;
  date: string;
  severity: "low" | "medium" | "high";
  description: string;
  endorsingManagers: string[]; // List of manager IDs
  status: "draft" | "submitted" | "pending" | "resolved";
  studentName?: string;
  studentRoom?: string;
  studentBatch?: string;
  actionTaken?: string;
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
const INITIAL_MANAGERS: Record<string, ManagerProfile> = {};

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

  private sanitizeManagerId(managerId: string): string {
    return managerId.trim().toLowerCase().replace(/\s+/g, "_");
  }

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

  async deleteManagerProfile(id: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "managers", id);
      await deleteDoc(docRef);
    } else {
      const managers = getMockData<Record<string, ManagerProfile>>("managers", INITIAL_MANAGERS);
      if (managers[id]) {
        delete managers[id];
        saveMockData("managers", managers);
      }
    }
    this.clearCache("managers_list");
    this.clearCache(`manager_profile_${id}`);
    await this.logAction("DELETE_PROFILE", { id });
  }

  // --- MANAGER TEAMS (V1) ---
  async getTeamProfile(teamName: string): Promise<ManagerTeam | null> {
    const key = teamName.toLowerCase();
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "teams", key);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as ManagerTeam) : null;
    } else {
      const teams = getMockData<Record<string, ManagerTeam>>("manager_teams", {});
      return teams[key] || null;
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
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "cashCollection", sId);
      const snap = await getDoc(docRef);
      return snap.exists() ? snap.data().amount : 0;
    } else {
      const cash = getMockData("cashCollection", {} as Record<string, number>);
      return cash[sId] || 0;
    }
  }

  async setCashCollection(managerId: string, amount: number): Promise<void> {
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "cashCollection", sId);
      await setDoc(docRef, { amount });
    } else {
      const cash = getMockData("cashCollection", {} as Record<string, number>);
      cash[sId] = amount;
      saveMockData("cashCollection", cash);
    }
    await this.logAction("SET_CASH", { managerId: sId, amount });
  }

  // --- EXPENSES ---
  async getExpenses(managerId: string, date?: string): Promise<DayExpenses[]> {
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      if (date) {
        const docRef = doc(db, "expenses", sId, "days", date);
        const snap = await getDoc(docRef);
        return snap.exists() ? [snap.data() as DayExpenses] : [];
      } else {
        const q = collection(db, "expenses", sId, "days");
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as DayExpenses);
      }
    } else {
      const key = `expenses_${sId}`;
      const expenses = getMockData<Record<string, DayExpenses>>(key, {});
      if (date) {
        return expenses[date] ? [expenses[date]] : [];
      }
      return Object.values(expenses).sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // Cursor-based paginated past expenses (SCALE-01)
  async getExpensesPaginated(managerId: string, pageSize = 20, lastDocCursor: any = null): Promise<PaginatedResult<DayExpenses>> {
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      let q = query(
        collection(db, "expenses", sId, "days"),
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
      const key = `expenses_${sId}`;
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
    const sId = this.sanitizeManagerId(managerId);
    // Recompute totals inside the service layer (FUNC-02)
    const sanitizedItems = items.map(item => ({
      ...item,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100
    }));
    
    const total = sanitizedItems.reduce((sum, item) => sum + item.total, 0);
    const dayData: DayExpenses = { date, items: sanitizedItems, total, isLocked };

    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "expenses", sId, "days", date);
      await setDoc(docRef, dayData);
    } else {
      const key = `expenses_${sId}`;
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
    const sId = this.sanitizeManagerId(managerId);
    const cacheKey = `inventory_${sId}`;
    const cached = this.getCached<InventoryItem[]>(cacheKey);
    if (cached) return cached;

    let result: InventoryItem[];
    if (isFirebaseEnabled && db) {
      const q = collection(db, "inventory", sId, "items");
      const snap = await getDocs(q);
      result = snap.docs.map(d => d.data() as InventoryItem);
    } else {
      const key = `inventory_${sId}`;
      result = getMockData<InventoryItem[]>(key, INITIAL_INVENTORY);
    }
    this.setCache(cacheKey, result);
    return result;
  }

  async updateInventoryItem(managerId: string, item: InventoryItem): Promise<void> {
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "inventory", sId, "items", item.id);
      await setDoc(docRef, item);
    } else {
      const key = `inventory_${sId}`;
      const inv = getMockData<InventoryItem[]>(key, INITIAL_INVENTORY);
      const index = inv.findIndex(i => i.id === item.id);
      if (index > -1) {
        inv[index] = item;
      } else {
        inv.push(item);
      }
      saveMockData(key, inv);
    }
    this.clearCache(`inventory_${sId}`);
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
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "payments", sId);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data().paidStudentIds as { id: string; name: string; date: string }[]) : [];
    } else {
      return getMockData<{ id: string; name: string; date: string }[]>(`payments_${sId}`, []);
    }
  }

  async savePayments(managerId: string, paidStudentIds: { id: string; name: string; date: string }[]): Promise<void> {
    const sId = this.sanitizeManagerId(managerId);
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "payments", sId);
      await setDoc(docRef, { paidStudentIds });
    } else {
      saveMockData(`payments_${sId}`, paidStudentIds);
    }
    await this.logAction("SAVE_PAYMENTS", { managerId: sId, count: paidStudentIds.length });
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

  // --- PROVOST ---
  async getProvostProfile(): Promise<ProvostProfile> {
    const defaultProvost: ProvostProfile = {
      name: "Dr. Md. Ashiqur Rahman",
      dept: "Professor, Department of Mechanical Engineering · Provost, Sher-E-Bangla Hall, BUET",
      bio: "Associate Director, Directorate of Student Welfare (Former). Email: ashiqurrahman@me.buet.ac.bd · ashiqur78@yahoo.com",
      photoUrl: "data:image/png;base64,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"
    };

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, "notices", "provost");
        const snap = await getDoc(docRef);
        return snap.exists() ? (snap.data() as ProvostProfile) : defaultProvost;
      } catch (err) {
        console.error("Failed to fetch provost profile from Firestore:", err);
        return defaultProvost;
      }
    } else {
      return getMockData<ProvostProfile>("provost_profile", defaultProvost);
    }
  }

  async updateProvostProfile(data: ProvostProfile): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "notices", "provost");
      await setDoc(docRef, data);
    } else {
      saveMockData("provost_profile", data);
    }
    await this.logAction("UPDATE_PROVOST_PROFILE", data);
  }

  // --- DEVELOPER ---
  async getDeveloperPhoto(): Promise<string> {
    const defaultPhoto = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop";
    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, "notices", "developer");
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data().photoUrl : defaultPhoto;
      } catch (err) {
        console.error("Failed to fetch developer photo:", err);
        return defaultPhoto;
      }
    } else {
      return getMockData<string>("developer_photo", defaultPhoto);
    }
  }

  async updateDeveloperPhoto(photoUrl: string): Promise<void> {
    if (isFirebaseEnabled && db) {
      const docRef = doc(db, "notices", "developer");
      await setDoc(docRef, { photoUrl });
    } else {
      saveMockData("developer_photo", photoUrl);
    }
    await this.logAction("UPDATE_DEVELOPER_PHOTO", { photoUrl });
  }
}


export const dbService = new DbService();
export default dbService;
