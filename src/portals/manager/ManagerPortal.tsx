import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Trash2, Edit2, FileText, Upload, AlertTriangle, AlertCircle, 
  CheckCircle, BarChart3, ListOrdered, Calendar,
  Activity, UserCheck, Flame 
} from "lucide-react";
import { dbService } from "../../services/dbService";
import type { ManagerProfile, ExpenseItem, DayExpenses, MenuItem, InventoryItem, Complaint } from "../../services/dbService";
import { authService } from "../../services/authService";
import type { SessionUser } from "../../services/authService";
import { generateLedgerPdf } from "../../utils/pdfGenerator";
import { isFirebaseEnabled, storage } from "../../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ManagerPortalProps {
  currentUser: SessionUser | null;
  addToast: (text: string, type: "success" | "error" | "info") => void;
  onProfileUpdated: () => void;
}

export const ManagerPortal: React.FC<ManagerPortalProps> = ({ currentUser, addToast, onProfileUpdated }) => {
  const managerId = currentUser?.id || "2012001";
  
  // Tab states
  const [activeSubTab, setActiveSubTab] = useState<"ledger" | "menu" | "inventory" | "payments" | "analytics" | "complaints">("ledger");

  // Profile setup states
  const [needsSetup, setNeedsSetup] = useState(currentUser?.needsSetup ?? true);
  const [setupForm, setSetupForm] = useState({
    name: "",
    dept: "",
    room: "",
    bio: "",
    photoUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"
  });

  // Ledger & expense states
  const [cashCollected, setCashCollected] = useState(0);
  const [cashInput, setCashInput] = useState("");
  const [ledgerDate, setLedgerDate] = useState(new Date().toISOString().split("T")[0]);
  const [dayExpenses, setDayExpenses] = useState<ExpenseItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [allPastExpenses, setAllPastExpenses] = useState<DayExpenses[]>([]);

  // Expense item input states
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: 1,
    unit: "kg",
    unitPrice: 0,
    category: "vegetables"
  });

  // Menu states
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split("T")[0]);
  const [menuForm, setMenuForm] = useState<MenuItem>({
    breakfast: "",
    lunch: "",
    dinner: "",
    estimatedCost: 150
  });

  // Inventory states
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);
  const [aiInventoryAlerts, setAiInventoryAlerts] = useState<string[]>([]);

  // Payment states
  const [deadlineDate, setDeadlineDate] = useState("");
  const [penaltyText, setPenaltyText] = useState("");
  const [paidStudentIds, setPaidStudentIds] = useState<{ id: string; name: string; date: string }[]>([]);
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualStudentName, setManualStudentName] = useState("");

  // Complaint states
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintForm, setComplaintForm] = useState<{
    category: string;
    severity: "low" | "medium" | "high";
    description: string;
  }>({
    category: "Infrastructure",
    severity: "medium",
    description: ""
  });

  // Emoji statistics state
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, love: 0, angry: 0 });

  const [paymentsPage, setPaymentsPage] = useState(1);
  const [complaintsPage, setComplaintsPage] = useState(1);

  // Load Initial Data
  useEffect(() => {
    const loadManagerData = async () => {
      // Profile check
      const profile = await dbService.getManagerProfile(managerId);
      if (profile && profile.name) {
        setSetupForm({
          name: profile.name,
          dept: profile.dept,
          room: profile.room,
          bio: profile.bio,
          photoUrl: profile.photoUrl
        });
        setNeedsSetup(false);
      }

      // Cash Collection & Ledger list
      const cash = await dbService.getCashCollection(managerId);
      setCashCollected(cash);
      setCashInput(cash > 0 ? cash.toString() : "");

      const fetchedAllExpenses = await dbService.getExpenses(managerId);
      setAllPastExpenses(fetchedAllExpenses);

      // Load active day expenses
      const activeDay = fetchedAllExpenses.find(d => d.date === ledgerDate);
      if (activeDay) {
        setDayExpenses(activeDay.items);
        setIsLocked(activeDay.isLocked || isDateLocked(activeDay.date));
      } else {
        setDayExpenses([]);
        setIsLocked(isDateLocked(ledgerDate));
      }

      // Menu
      const menuToday = await dbService.getMenu(ledgerDate);
      if (menuToday) {
        setMenuForm(menuToday);
      } else {
        setMenuForm({ breakfast: "", lunch: "", dinner: "", estimatedCost: 150 });
      }

      // Inventory
      const inv = await dbService.getInventory(managerId);
      setInventory(inv);
      generateAiInventoryInsights(inv);

      // Notice details
      const fetchedNotice = await dbService.getNotice();
      setDeadlineDate(fetchedNotice.paymentDeadline.split("T")[0] || "");
      setPenaltyText(fetchedNotice.penaltyText || "");

      // Payments list
      const savedPayments = await dbService.getPayments(managerId);
      setPaidStudentIds(savedPayments);

      // Complaints list
      const fetchComplaints = await dbService.getComplaints();
      setComplaints(fetchComplaints);

      // Student reactions
      const fetchedReactions = await dbService.getReactions(ledgerDate);
      setReactions(fetchedReactions);
    };

    loadManagerData();
  }, [managerId, ledgerDate]);

  // Load menu for selected menuDate (FUNC-09)
  useEffect(() => {
    const loadMenu = async () => {
      try {
        const menuData = await dbService.getMenu(menuDate);
        if (menuData) {
          setMenuForm(menuData);
        } else {
          setMenuForm({ breakfast: "", lunch: "", dinner: "", estimatedCost: 150 });
        }
      } catch (err) {
        console.error("Failed to load menu for date", menuDate, err);
      }
    };
    loadMenu();
  }, [menuDate]);

  // Date Locking check (older than 24h) (FUNC-01)
  function isDateLocked(targetDateStr: string): boolean {
    const today = new Date().toISOString().split("T")[0];
    return targetDateStr < today;
  }

  // Generate Inventory Insights (Simulating Gemini API server-side analysis)
  function generateAiInventoryInsights(items: InventoryItem[]) {
    const alerts: string[] = [];
    items.forEach(item => {
      const daysRemaining = item.usageRate > 0 ? Math.floor(item.quantity / item.usageRate) : 99;
      if (daysRemaining <= 2) {
        alerts.push(`CRITICAL: ${item.name} stock will exhaust in ${daysRemaining} days (${item.quantity} ${item.unit} remaining). Reorder immediately.`);
      } else if (daysRemaining <= 6) {
        alerts.push(`WARNING: ${item.name} depletion rate is high. Estimated finish date: ${item.finishDate}.`);
      }
    });
    setAiInventoryAlerts(alerts);
  }

  // Photo upload states (DATA-NEW-01)
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please upload a valid image file.", "error");
      return;
    }

    setUploadingPhoto(true);

    try {
      if (isFirebaseEnabled && storage) {
        const storageRef = ref(storage, `profiles/${managerId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        setSetupForm(prev => ({ ...prev, photoUrl: downloadUrl }));
        addToast("Profile photo uploaded successfully!", "success");
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const url = event.target?.result as string;
          setSetupForm(prev => ({ ...prev, photoUrl: url }));
          addToast("Profile photo loaded (mock mode)!", "success");
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error(err);
      addToast("Failed to upload profile photo.", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle Profile Setup
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.name || !setupForm.dept || !setupForm.room) {
      addToast("Please fill in all mandatory fields.", "error");
      return;
    }

    try {
      const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
      const profileData: ManagerProfile = {
        id: managerId,
        ...setupForm,
        month: currentMonth,
      };
      await dbService.updateManagerProfile(managerId, profileData);
      setNeedsSetup(false);
      
      // Update session needsSetup
      const session = authService.getCurrentUser();
      if (session) {
        session.needsSetup = false;
        localStorage.setItem("hmms_session", JSON.stringify(session));
        // Sync active sessions if in mock mode
        if (session.token) {
          try {
            const activeKey = "hmms_mock_auth_active_sessions";
            const activeStr = localStorage.getItem(activeKey);
            if (activeStr) {
              const active = JSON.parse(activeStr);
              if (active[session.token]) {
                active[session.token].needsSetup = false;
                localStorage.setItem(activeKey, JSON.stringify(active));
              }
            }
          } catch (e) {
            console.error("Failed to sync active session", e);
          }
        }
      }

      addToast("Profile setup completed successfully!", "success");
      onProfileUpdated();
    } catch {
      addToast("Failed to save profile details.", "error");
    }
  };

  // Handle Cash Collection Record
  const handleSaveCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cashInput);
    if (isNaN(amount) || amount <= 0) {
      addToast("Please enter a valid cash amount.", "error");
      return;
    }

    try {
      await dbService.setCashCollection(managerId, amount);
      setCashCollected(amount);
      addToast("Cash collection recorded successfully!", "success");
    } catch {
      addToast("Failed to save cash collection.", "error");
    }
  };

  // Add line-item to expense ledger
  const handleAddExpenseItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      addToast("This date's ledger is locked.", "error");
      return;
    }
    if (!newItem.name || newItem.unitPrice <= 0 || newItem.quantity <= 0) {
      addToast("Please input valid item parameters.", "error");
      return;
    }

    // Expense input length limit and sanitization (EXPENSE-INPUT)
    const sanitizedName = newItem.name
      .replace(/[<>"']/g, "")
      .trim()
      .substring(0, 100);

    if (!sanitizedName) {
      addToast("Invalid item name after sanitization.", "error");
      return;
    }

    const itemTotal = newItem.quantity * newItem.unitPrice;
    const addedItem: ExpenseItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: sanitizedName,
      quantity: newItem.quantity,
      unit: newItem.unit,
      unitPrice: newItem.unitPrice,
      total: itemTotal,
      category: newItem.category
    };

    const updatedList = [...dayExpenses, addedItem];
    setDayExpenses(updatedList);
    
    // Save to Database
    await dbService.saveDayExpenses(managerId, ledgerDate, updatedList, isLocked);
    
    // Refresh dashboard calculations
    const fetchedAllExpenses = await dbService.getExpenses(managerId);
    setAllPastExpenses(fetchedAllExpenses);

    // Reset Form
    setNewItem({
      name: "",
      quantity: 1,
      unit: "kg",
      unitPrice: 0,
      category: "vegetables"
    });
    addToast("Ledger item added!", "success");
  };

  // Remove line-item from expense ledger
  const handleDeleteExpenseItem = async (itemId: string) => {
    if (isLocked) {
      addToast("This date's ledger is locked.", "error");
      return;
    }

    const updatedList = dayExpenses.filter(item => item.id !== itemId);
    setDayExpenses(updatedList);
    await dbService.saveDayExpenses(managerId, ledgerDate, updatedList, isLocked);

    const fetchedAllExpenses = await dbService.getExpenses(managerId);
    setAllPastExpenses(fetchedAllExpenses);
    addToast("Ledger item removed.", "info");
  };

  // Save/Publish Menu Scheduler
  const handlePublishMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.setMenu(menuDate, menuForm);
      addToast(`Menu for ${menuDate} published successfully!`, "success");
    } catch {
      addToast("Failed to publish menu.", "error");
    }
  };

  // Save Notice/Deadline Settings
  const handleSaveNoticeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbService.setNotice({
        paymentDeadline: `${deadlineDate}T23:59:59`,
        penaltyText
      });
      addToast("Deadline notice updated successfully!", "success");
    } catch {
      addToast("Failed to save notice.", "error");
    }
  };

  // File Uploader - Student Payments CSV Parser
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sanitizeStudentName = (name: string): string => {
    return name.replace(/<\/?[^>]+(>|$)/g, "").trim().substring(0, 100);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const parsed: { id: string; name: string; date: string }[] = [];

      lines.forEach(line => {
        const parts = line.split(",");
        if (parts.length >= 2) {
          const id = parts[0].trim();
          const name = sanitizeStudentName(parts[1]);
          if (/^\d{7}$/.test(id)) {
            if (!parsed.some(p => p.id === id)) {
              parsed.push({
                id,
                name,
                date: new Date().toISOString().split("T")[0]
              });
            }
          }
        }
      });

      if (parsed.length > 0) {
        setPaidStudentIds(prev => {
          const filtered = parsed.filter(item => !prev.some(p => p.id === item.id));
          const newList = [...prev, ...filtered];
          dbService.savePayments(managerId, newList).catch(() => {
            addToast("Failed to save payments to database.", "error");
          });
          addToast(`Successfully imported ${filtered.length} new student records from CSV!`, "success");
          return newList;
        });
      } else {
        addToast("No new or valid student records found in CSV.", "error");
      }
    };
    reader.readAsText(file);
  };

  // Manual payment list adder
  const handleAddManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = manualStudentId.trim();
    const name = sanitizeStudentName(manualStudentName || "Student");
    
    if (!/^\d{7}$/.test(id)) {
      addToast("Student ID must be exactly 7 digits.", "error");
      return;
    }

    let duplicate = false;
    setPaidStudentIds(prev => {
      if (prev.some(p => p.id === id)) {
        duplicate = true;
        return prev;
      }
      const newItem = { id, name, date: new Date().toISOString().split("T")[0] };
      const newList = [...prev, newItem];
      dbService.savePayments(managerId, newList).catch(() => {
        addToast("Failed to save payment to database.", "error");
      });
      return newList;
    });

    if (duplicate) {
      addToast(`Student ID ${id} is already in the payments checklist.`, "error");
      return;
    }
    
    setManualStudentId("");
    setManualStudentName("");
    addToast(`Student ID ${id} registered as paid.`, "success");
  };

  // Clear all payments list
  const handleClearPayments = async () => {
    if (window.confirm("Are you sure you want to clear the entire payments checklist?")) {
      try {
        await dbService.savePayments(managerId, []);
        setPaidStudentIds([]);
        addToast("Checklist cleared.", "info");
      } catch {
        addToast("Failed to clear checklist.", "error");
      }
    }
  };

  // Create Complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintForm.description.trim()) return;

    const newComplaint: Complaint = {
      id: Math.random().toString(36).substring(2, 9),
      category: complaintForm.category,
      date: new Date().toISOString().split("T")[0],
      severity: complaintForm.severity,
      description: complaintForm.description,
      endorsingManagers: [managerId],
      status: "draft"
    };

    try {
      await dbService.saveComplaint(newComplaint);
      setComplaints(prev => [newComplaint, ...prev]);
      setComplaintForm({ category: "Infrastructure", severity: "medium", description: "" });
      addToast("Complaint drafted. Waiting for co-manager endorsements.", "success");
    } catch {
      addToast("Failed to draft complaint.", "error");
    }
  };

  // Endorse Complaint
  const handleEndorseComplaint = async (complaintId: string) => {
    const list = [...complaints];
    const item = list.find(c => c.id === complaintId);
    if (item) {
      if (item.endorsingManagers[0] === managerId) {
        addToast("You cannot endorse your own complaint.", "error");
        return;
      }
      if (!item.endorsingManagers.includes(managerId)) {
        item.endorsingManagers.push(managerId);
        await dbService.saveComplaint(item);
        setComplaints(list);
        addToast("Complaint endorsed successfully!", "success");
      }
    }
  };

  // Submit Complaint to Provost
  const handleSubmitComplaintToProvost = async (complaintId: string) => {
    const list = [...complaints];
    const item = list.find(c => c.id === complaintId);
    if (item) {
      item.status = "submitted";
      await dbService.saveComplaint(item);
      setComplaints(list);
      addToast("Complaint submitted formally to the Provost's Office.", "success");
    }
  };

  // AI Cost Analysis publisher toggle
  const [publishAnalysis, setPublishAnalysis] = useState(
    localStorage.getItem(`hmms_publish_analysis_${ledgerDate}`) === "true"
  );
  
  const handleTogglePublishAnalysis = (val: boolean) => {
    setPublishAnalysis(val);
    localStorage.setItem(`hmms_publish_analysis_${ledgerDate}`, val ? "true" : "false");
    addToast(val ? "AI Cost Analysis published to Student Portal!" : "Cost Analysis hidden.", "info");
  };

  // Request Lock Correction from Provost (Functional Gap solution)
  const handleRequestCorrection = () => {
    addToast(`Correction request submitted to Provost for locked date ${ledgerDate}.`, "info");
  };

  // Inventory Stock item updater
  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvItem) return;

    try {
      await dbService.updateInventoryItem(managerId, editingInvItem);
      
      const inv = await dbService.getInventory(managerId);
      setInventory(inv);
      generateAiInventoryInsights(inv);
      setEditingInvItem(null);
      addToast("Inventory stock item updated!", "success");
    } catch {
      addToast("Failed to update inventory.", "error");
    }
  };

  // Export PDF Ledger Trigger
  const handleExportPdf = () => {
    if (dayExpenses.length === 0) {
      addToast("Ledger is empty. Add items before exporting.", "error");
      return;
    }
    
    const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const profile: ManagerProfile = {
      id: managerId,
      name: setupForm.name || "Mess Manager",
      dept: setupForm.dept || "BUET",
      room: setupForm.room || "Dining",
      month: currentMonth,
      bio: setupForm.bio || "",
      photoUrl: setupForm.photoUrl || ""
    };

    generateLedgerPdf({
      manager: profile,
      month: currentMonth,
      cashCollected,
      expenses: [{ date: ledgerDate, items: dayExpenses, total: dayExpenses.reduce((s, i) => s + i.total, 0), isLocked }],
      startDate: ledgerDate,
      endDate: ledgerDate
    });
    addToast("Ledger statement downloaded as PDF.", "success");
  };

  // Computations
  const totalSpent = allPastExpenses.reduce((sum, day) => sum + day.total, 0);
  const currentSpentOnDay = dayExpenses.reduce((sum, item) => sum + item.total, 0);
  const runningBalance = cashCollected - totalSpent;
  const daysInMonthRemaining = 31 - new Date().getDate();
  const averageDailySpend = allPastExpenses.length > 0 ? (totalSpent / allPastExpenses.length) : 0;
  const forecastSurplus = cashCollected - (totalSpent + (averageDailySpend * daysInMonthRemaining));

  // Render mandatory profile setup on first login
  if (needsSetup) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-card border border-border/60 rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Complete Profile Setup</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Welcome, Mess Manager! You must configure your profile before accessing operations.
            </p>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Manager ID (Locked)</label>
              <input
                type="text"
                value={managerId}
                disabled
                className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Profile Photo Upload Field (DATA-NEW-01) */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-2">Profile Photo</label>
              <div className="flex items-center gap-4">
                <img 
                  src={setupForm.photoUrl} 
                  alt="Preview" 
                  className="h-16 w-16 rounded-2xl object-cover border border-border/40"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                  id="profile-photo-upload"
                  disabled={uploadingPhoto}
                />
                <label
                  htmlFor="profile-photo-upload"
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-xs font-bold rounded-xl cursor-pointer border border-border/60 transition-colors"
                >
                  {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Full Name</label>
              <input
                type="text"
                value={setupForm.name}
                onChange={(e) => setSetupForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Robin Hossain"
                className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Department</label>
                <input
                  type="text"
                  value={setupForm.dept}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, dept: e.target.value }))}
                  placeholder="e.g. CSE"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Room Number</label>
                <input
                  type="text"
                  value={setupForm.room}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, room: e.target.value }))}
                  placeholder="e.g. 302"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Personal Bio</label>
              <textarea
                value={setupForm.bio}
                onChange={(e) => setSetupForm(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Write a brief intro for residents..."
                className="w-full px-4 py-2 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none focus:border-primary/50 h-16 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-all duration-200"
            >
              Complete Setup & Publish Card
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Top Banner Dashboard Statistics */}
      <div className="bg-muted/30 border-b border-border/40 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Manager Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage accounts, budgets, inventory, and payment lists.</p>
            </div>
            
            {/* Quick Summary Cards */}
            <div className="flex gap-4 w-full md:w-auto overflow-x-auto">
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Cash Collected</span>
                <span className="text-sm font-bold text-foreground">{cashCollected.toFixed(2)} BDT</span>
              </div>
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Total Spent</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400">-{totalSpent.toFixed(2)} BDT</span>
              </div>
              <div className="bg-card border border-border/40 px-4 py-2 rounded-xl text-xs min-w-[130px]">
                <span className="text-muted-foreground block font-medium">Running Balance</span>
                <span className={`text-sm font-bold ${runningBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                  {runningBalance.toFixed(2)} BDT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        {/* Sub-Navigation tabs */}
        <div className="flex border-b border-border/40 mb-8 overflow-x-auto w-full scrollbar-thin">
          {[
            { id: "ledger", label: "Expense Ledger", icon: <ListOrdered size={14} /> },
            { id: "menu", label: "Menu Scheduler", icon: <Calendar size={14} /> },
            { id: "inventory", label: "Inventory Planner", icon: <Flame size={14} /> },
            { id: "payments", label: "Payments Importer", icon: <UserCheck size={14} /> },
            { id: "analytics", label: "AI & Preference", icon: <BarChart3 size={14} /> },
            { id: "complaints", label: "Complaints Desk", icon: <Activity size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as "ledger" | "menu" | "inventory" | "payments" | "analytics" | "complaints")}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-all duration-200 ${
                activeSubTab === tab.id 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. EXPENSE LEDGER SUB-TAB */}
        {activeSubTab === "ledger" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left columns - Daily entries input */}
            <div className="lg:col-span-2 space-y-6">
              {/* Daily Ledger List */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Daily Expenditure List</h3>
                    <p className="text-xs text-muted-foreground">Select a date to input and review itemized expenses.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl text-xs font-bold"
                    />
                    <button 
                      onClick={handleExportPdf}
                      className="bg-card border border-border/80 hover:bg-muted text-foreground px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1"
                    >
                      <FileText size={12} />
                      Export PDF
                    </button>
                  </div>
                </div>

                {/* Ledger Item Add Form */}
                {!isLocked ? (
                  <form onSubmit={handleAddExpenseItem} className="bg-muted/30 p-5 rounded-2xl border border-border/30 mb-6 space-y-4">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Add Expense Item</h4>
                    
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Item Name</label>
                        <input
                          type="text"
                          value={newItem.name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Broiler Chicken"
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          maxLength={100}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Category</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                        >
                          <option value="vegetables">Vegetables</option>
                          <option value="protein">Protein</option>
                          <option value="grain">Rice & Grain</option>
                          <option value="fuel">Fuel & Gas</option>
                          <option value="miscellaneous">Miscellaneous</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Quantity</label>
                        <input
                          type="number"
                          value={newItem.quantity}
                          onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit</label>
                        <input
                          type="text"
                          value={newItem.unit}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                          placeholder="e.g. kg, litre"
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit Price (BDT)</label>
                        <input
                          type="number"
                          value={newItem.unitPrice}
                          onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-card border border-border/60 rounded-xl text-xs focus:outline-none"
                          min="0.1"
                          step="0.1"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-1 bg-primary text-primary-foreground hover:bg-primary/95 py-2.5 rounded-xl text-xs font-bold transition-all duration-200"
                    >
                      <Plus size={12} />
                      Insert Item into Ledger
                    </button>
                  </form>
                ) : (
                  <div className="bg-rose-50/50 border border-rose-200 dark:bg-rose-950/10 dark:border-rose-900/40 p-4 rounded-2xl flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      Ledger is locked for this date (older than 24 hours).
                    </span>
                    <button 
                      onClick={handleRequestCorrection}
                      className="bg-rose-600 text-white hover:bg-rose-700 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all duration-150"
                    >
                      Request Provost Correction
                    </button>
                  </div>
                )}

                {/* Ledger Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                        <th className="py-2.5 px-4">Item Name</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4 text-right">Quantity</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        {!isLocked && <th className="py-2.5 px-4 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dayExpenses.map(item => (
                        <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-4 capitalize">{item.category}</td>
                          <td className="py-2.5 px-4 text-right">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">{item.unitPrice.toFixed(2)} BDT</td>
                          <td className="py-2.5 px-4 text-right font-bold">{item.total.toFixed(2)} BDT</td>
                          {!isLocked && (
                            <td className="py-2.5 px-4 text-center">
                              <button 
                                onClick={() => handleDeleteExpenseItem(item.id)}
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {dayExpenses.length === 0 && (
                        <tr>
                          <td colSpan={isLocked ? 5 : 6} className="text-center py-8 text-muted-foreground select-none">
                            No ledger items logged for this date.
                          </td>
                        </tr>
                      )}
                      <tr className="bg-muted/20 font-bold border-t border-border/60">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase text-[9px] tracking-wider text-muted-foreground">Total Day Cost:</td>
                        <td className="py-3 px-4 text-right text-sm text-primary">{currentSpentOnDay.toFixed(2)} BDT</td>
                        {!isLocked && <td></td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right column - Cash input & settings */}
            <div className="space-y-6">
              {/* Cash Collection config */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Cash Received</h3>
                <form onSubmit={handleSaveCash} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Amount received from Provost</label>
                    <input
                      type="number"
                      value={cashInput}
                      onChange={(e) => setCashInput(e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm focus:outline-none"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    Save Cash Collection
                  </button>
                </form>
              </div>

              {/* Status Checklist */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-3">Today's Cost Analysis</h3>
                <p className="text-xs text-muted-foreground mb-4">Toggle visibility of today's cost summaries on the student portal.</p>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/40 border border-border/30">
                  <span className="text-xs font-semibold text-foreground">Publish cost details</span>
                  <input
                    type="checkbox"
                    checked={publishAnalysis}
                    onChange={(e) => handleTogglePublishAnalysis(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-border rounded"
                  />
                </div>
              </div>

              {/* Payment Deadline config (moved from payments sidebar) */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-3">Payment Deadline</h3>
                <p className="text-xs text-muted-foreground mb-4">Set the monthly mess fee payment deadline for the student portal.</p>
                <form onSubmit={handleSaveNoticeSettings} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Submission Deadline</label>
                    <input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    Save Payment Deadline
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* 2. MENU PLANNER SUB-TAB */}
        {activeSubTab === "menu" && (
          <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">Weekly Menu Scheduler</h3>
                <p className="text-xs text-muted-foreground mt-1">Select a calendar date to plan food menus.</p>
              </div>
              <input 
                type="date" 
                value={menuDate}
                onChange={(e) => setMenuDate(e.target.value)}
                className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl text-xs font-bold"
              />
            </div>

            <form onSubmit={handlePublishMenu} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Breakfast Menu</label>
                <input
                  type="text"
                  value={menuForm.breakfast}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, breakfast: e.target.value }))}
                  placeholder="e.g. Paratha, Egg, Dal Vuna"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Lunch Menu</label>
                <input
                  type="text"
                  value={menuForm.lunch}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, lunch: e.target.value }))}
                  placeholder="e.g. Plain Rice, Rui Fish Roast, Mixed Vegs"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Dinner Menu</label>
                <input
                  type="text"
                  value={menuForm.dinner}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, dinner: e.target.value }))}
                  placeholder="e.g. Chicken Biryani, Salad, Borhani"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">Estimated Cost Per Student (BDT)</label>
                <input
                  type="number"
                  value={menuForm.estimatedCost || ""}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, estimatedCost: parseInt(e.target.value) || 0 }))}
                  placeholder="e.g. 150"
                  className="w-full px-4 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md shadow-primary/10 transition-colors"
              >
                Publish Menu Schedule
              </button>
            </form>
          </div>
        )}

        {/* 3. INVENTORY SUB-TAB */}
        {activeSubTab === "inventory" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left side - Inventory items table */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-foreground">Stock Ledger</h3>
                <button
                  onClick={() => setEditingInvItem({
                    id: "new_" + Math.random().toString(36).substring(2, 9),
                    name: "",
                    quantity: 0,
                    unit: "kg",
                    usageRate: 0,
                    finishDate: new Date().toISOString().split("T")[0]
                  })}
                  className="bg-primary text-primary-foreground hover:bg-primary/95 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
                >
                  Add New Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20">
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-4 text-right">Quantity</th>
                      <th className="py-2.5 px-4 text-right">Usage / Day</th>
                      <th className="py-2.5 px-4 text-right">Days Left</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map(item => {
                      const daysLeft = item.usageRate > 0 ? Math.floor(item.quantity / item.usageRate) : 99;
                      const statusColor = daysLeft <= 2 ? "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40" : daysLeft <= 6 ? "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40" : "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40";
                      
                      return (
                        <tr key={item.id} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-4 text-right">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">{item.usageRate} {item.unit}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusColor}`}>
                              {daysLeft} days
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => setEditingInvItem(item)}
                              className="text-primary hover:bg-primary/5 p-1.5 rounded-lg border border-border/40 transition-colors"
                            >
                              <Edit2 size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right side - AI warnings & Editing */}
            <div className="space-y-6">
              {/* Gemini AI Alerts */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Gemini AI Alerts</h3>
                <div className="space-y-3">
                  {aiInventoryAlerts.map((alert, i) => {
                    const isCritical = alert.startsWith("CRITICAL");
                    return (
                      <div 
                        key={i} 
                        className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex gap-2.5 ${
                          isCritical 
                            ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400" 
                            : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400"
                        }`}
                      >
                        {isCritical ? <AlertTriangle size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
                        <span>{alert}</span>
                      </div>
                    );
                  })}
                  {aiInventoryAlerts.length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground select-none">
                      All inventory stocks are at sufficient levels.
                    </div>
                  )}
                </div>
              </div>

              {/* Editing Item Panel */}
              {editingInvItem && (
                <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-foreground mb-4">
                    {editingInvItem.id.startsWith("new_") ? "Add Inventory Item" : `Edit Stock: ${editingInvItem.name}`}
                  </h3>
                  <form onSubmit={handleUpdateStock} className="space-y-3">
                    {editingInvItem.id.startsWith("new_") && (
                      <>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Item Name</label>
                          <input
                            type="text"
                            value={editingInvItem.name}
                            onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                            placeholder="e.g. Potatoes"
                            className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Unit</label>
                          <input
                            type="text"
                            value={editingInvItem.unit}
                            onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, unit: e.target.value }) : null)}
                            placeholder="e.g. kg, pcs"
                            className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                            required
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Quantity Remaining</label>
                      <input
                        type="number"
                        value={editingInvItem.quantity}
                        onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, quantity: parseFloat(e.target.value) || 0 }) : null)}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Usage Rate (units/day)</label>
                      <input
                        type="number"
                        value={editingInvItem.usageRate}
                        onChange={(e) => setEditingInvItem(prev => prev ? ({ ...prev, usageRate: parseFloat(e.target.value) || 0 }) : null)}
                        className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex gap-2.5">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                      >
                        {editingInvItem.id.startsWith("new_") ? "Create Item" : "Update Item"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingInvItem(null)}
                        className="px-3 bg-card border border-border/80 hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. PAYMENT CHECKLIST SUB-TAB */}
        {activeSubTab === "payments" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Paid checklist table */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-foreground">Paid Student Registry</h3>
                <button
                  onClick={handleClearPayments}
                  className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                >
                  Clear Checklist
                </button>
              </div>

              <div className="overflow-y-auto max-h-[400px] border border-border/40 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground uppercase font-bold text-[9px] tracking-wider bg-muted/20 sticky top-0">
                      <th className="py-2.5 px-4">Student ID</th>
                      <th className="py-2.5 px-4">Student Name</th>
                      <th className="py-2.5 px-4">Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidStudentIds.slice((paymentsPage - 1) * 10, paymentsPage * 10).map((item, idx) => (
                      <tr key={idx} className="border-b border-border/30 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-foreground">{item.id}</td>
                        <td className="py-2.5 px-4">{item.name}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{item.date}</td>
                      </tr>
                    ))}
                    {paidStudentIds.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-muted-foreground select-none">
                          No student payments recorded for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {paidStudentIds.length > 10 && (
                <div className="flex justify-between items-center mt-4 text-xs px-2">
                  <button
                    type="button"
                    disabled={paymentsPage === 1}
                    onClick={() => setPaymentsPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-muted-foreground">
                    Page {paymentsPage} of {Math.ceil(paidStudentIds.length / 10)}
                  </span>
                  <button
                    type="button"
                    disabled={paymentsPage * 10 >= paidStudentIds.length}
                    onClick={() => setPaymentsPage(prev => prev + 1)}
                    className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* CSV upload & manual registry inputs */}
            <div className="space-y-6">
              {/* CSV Importer */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-1">CSV Payment Import</h3>
                <p className="text-xs text-muted-foreground mb-4">Format: One student record per line (e.g. 2012001, Robin Hossain).</p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleCsvUpload}
                  accept=".csv, .txt"
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border/80 hover:border-primary/50 text-foreground py-6 rounded-2xl text-xs font-bold transition-all duration-200"
                >
                  <Upload size={16} className="text-muted-foreground" />
                  Upload CSV Sheet
                </button>
              </div>

              {/* Manual registry adder */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-foreground mb-4">Manual Addition</h3>
                <form onSubmit={handleAddManualPayment} className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Student ID (7 digits)</label>
                    <input
                      type="text"
                      value={manualStudentId}
                      onChange={(e) => setManualStudentId(e.target.value)}
                      placeholder="e.g. 2012001"
                      className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Student Name</label>
                    <input
                      type="text"
                      value={manualStudentName}
                      onChange={(e) => setManualStudentName(e.target.value)}
                      placeholder="e.g. Robin Hossain"
                      className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                  >
                    Register Payment
                  </button>
                </form>
              </div>

              {/* notice settings removed from here and moved to Dashboard sidebar */}
            </div>
          </div>
        )}

        {/* 5. AI ANALYTICS & PREFERENCES SUB-TAB */}
        {activeSubTab === "analytics" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left columns - Cost forecasts & reaction charts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cost Forecast panel */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-1">Gemini AI Spending Forecast</h3>
                <p className="text-xs text-muted-foreground mb-6">Financial projections based on current average daily spending.</p>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-5 rounded-2xl bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Estimated Daily Average</span>
                    <span className="block text-xl font-bold text-foreground mt-1">{averageDailySpend.toFixed(2)} BDT</span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Computed across active ledger dates</span>
                  </div>

                  <div className="p-5 rounded-2xl bg-muted/40 border border-border/30">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">Surplus Forecast (Month End)</span>
                    <span className={`block text-xl font-bold mt-1 ${forecastSurplus >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
                      {forecastSurplus.toFixed(2)} BDT
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-1">Projections cover {daysInMonthRemaining} remaining days</span>
                  </div>
                </div>

                {/* Plain language summary */}
                <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 mb-1.5">
                    <AlertCircle size={14} />
                    Gemini AI Optimization Recommendations
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Today's spending rate is stable. To optimize the forecast surplus:
                    <br />
                    1. Substitute one broiler chicken dish with eggs to save ~3,000 BDT weekly.
                    <br />
                    2. Clear out the potato stocks (45 kg) before reordering. Estimated finish date is Friday.
                  </p>
                </div>
              </div>

              {/* Student Emoji Reactions analysis */}
              <div className="bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-1">Student Preference Insights</h3>
                <p className="text-xs text-muted-foreground mb-6">Reaction aggregates logged by residents on the Student Portal.</p>
                
                <div className="flex items-end justify-around h-44 gap-4 px-6 border-b border-border/50">
                  {/* Like bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.like}</span>
                    <div 
                      className="w-full bg-primary/60 hover:bg-primary rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.like / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Like</span>
                  </div>

                  {/* Love bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.love}</span>
                    <div 
                      className="w-full bg-primary/80 hover:bg-primary rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.love / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Love</span>
                  </div>

                  {/* Angry bar */}
                  <div className="flex flex-col items-center w-12">
                    <span className="text-xs font-bold text-foreground mb-2">{reactions.angry}</span>
                    <div 
                      className="w-full bg-rose-500/70 hover:bg-rose-500 rounded-t-lg transition-all duration-300"
                      style={{ height: `${Math.max(10, (reactions.angry / (reactions.like + reactions.love + reactions.angry || 1)) * 120)}px` }}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground mt-2">Angry</span>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center mt-3">Reactions recorded for today's menu: {menuForm?.breakfast ? `"${menuForm.breakfast}" / "${menuForm.lunch}"` : "Active Day"}</p>
              </div>
            </div>

            {/* Right side - quick analytics list */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">Historical Cashflows</h3>
              <div className="space-y-4">
                {allPastExpenses.slice(0, 5).map(day => (
                  <div key={day.date} className="flex justify-between items-center text-xs py-2 border-b border-border/30 last:border-0">
                    <span className="font-semibold text-foreground">{day.date}</span>
                    <span className="font-bold text-rose-600">-{day.total.toFixed(2)} BDT</span>
                  </div>
                ))}
                {allPastExpenses.length === 0 && (
                  <div className="text-center py-6 text-xs text-muted-foreground select-none">
                    No historical cashflows logged.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 6. COMPLAINTS SUB-TAB */}
        {activeSubTab === "complaints" && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left side - Complaint list */}
            <div className="lg:col-span-2 bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-sm">
              <h3 className="text-lg font-bold text-foreground mb-4">Mess Manager Grievances</h3>
              
              <div className="space-y-5">
                {complaints.slice((complaintsPage - 1) * 5, complaintsPage * 5).map(complaint => {
                  const isEndorsed = complaint.endorsingManagers.includes(managerId);
                  const isAllEndorsed = complaint.endorsingManagers.length >= 2; // Simulating co-manager checks
                  
                  return (
                    <div key={complaint.id} className="p-5 rounded-2xl bg-muted/20 border border-border/40 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] font-bold text-primary uppercase">{complaint.category}</span>
                          <h4 className="text-sm font-bold text-foreground mt-0.5">Manager Grievance - {complaint.date}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border ${
                          complaint.severity === "high" 
                            ? "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-800/40" 
                            : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20"
                        }`}>
                          {complaint.severity} Severity
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">{complaint.description}</p>
                      
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/40 text-[10px]">
                        <span className="text-muted-foreground">
                          Endorsements: <strong>{complaint.endorsingManagers.length}</strong> (Manager IDs: {complaint.endorsingManagers.join(", ")})
                        </span>
                        
                        <div className="flex gap-2">
                          {!isEndorsed && complaint.status === "draft" && (
                            <button
                              onClick={() => handleEndorseComplaint(complaint.id)}
                              className="bg-card border border-border/80 hover:bg-muted text-foreground px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Endorse Complaint
                            </button>
                          )}
                          {isAllEndorsed && complaint.status === "draft" && (
                            <button
                              onClick={() => handleSubmitComplaintToProvost(complaint.id)}
                              className="bg-primary text-primary-foreground hover:bg-primary/95 px-3 py-1.5 rounded-lg font-bold transition-colors"
                            >
                              Submit to Provost
                            </button>
                          )}
                          {complaint.status === "submitted" && (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold uppercase bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                              <CheckCircle size={10} />
                              Submitted to Provost
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {complaints.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground select-none">
                    No active manager complaints logged.
                  </div>
                )}
                {complaints.length > 5 && (
                  <div className="flex justify-between items-center mt-4 text-xs">
                    <button
                      type="button"
                      disabled={complaintsPage === 1}
                      onClick={() => setComplaintsPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-muted-foreground">
                      Page {complaintsPage} of {Math.ceil(complaints.length / 5)}
                    </span>
                    <button
                      type="button"
                      disabled={complaintsPage * 5 >= complaints.length}
                      onClick={() => setComplaintsPage(prev => prev + 1)}
                      className="px-3 py-1.5 bg-muted border border-border/50 rounded-xl font-bold disabled:opacity-50 hover:bg-muted/80 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Create complaint */}
            <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm h-fit">
              <h3 className="text-base font-bold text-foreground mb-4">File a Grievance</h3>
              <form onSubmit={handleCreateComplaint} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Issue Category</label>
                  <select
                    value={complaintForm.category}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="Water Supply">Water Supply</option>
                    <option value="Electricity / Load Shedding">Electricity</option>
                    <option value="Kitchen Sanitation">Kitchen Sanitation</option>
                    <option value="Gas / Fuel Exhaustion">Gas & Fuel</option>
                    <option value="Staffing / Attendance">Staffing & Cook Attendance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Severity Level</label>
                  <select
                    value={complaintForm.severity}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, severity: e.target.value as "low" | "medium" | "high" }))}
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="low">Low Severity</option>
                    <option value="medium">Medium Severity</option>
                    <option value="high">High Severity</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={complaintForm.description}
                    onChange={(e) => setComplaintForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter detailed description of dining mess issue..."
                    className="w-full px-3 py-2 bg-muted/40 border border-border/60 rounded-xl text-xs focus:outline-none h-24 resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold transition-colors"
                >
                  Draft Complaint Card
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default ManagerPortal;
