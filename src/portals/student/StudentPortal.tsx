import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, ThumbsUp, Angry, Send, Calendar, AlertCircle, Phone, 
  MessageSquare, Clock, ArrowRight, User
} from "lucide-react";
import { dbService } from "../../services/dbService";
import type { MenuItem, Contact, Broadcast, Comment, ManagerProfile } from "../../services/dbService";

interface StudentPortalProps {
  addToast: (text: string, type: "success" | "error" | "info") => void;
  lang: "en" | "bn";
  activeTab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers";
  setActiveTab: (tab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers") => void;
}

const GALLERY_ITEMS = [
  { name: "Md. Rajib Khan", dept: "CSE", batch: "2022", img: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80" },
  { name: "Fatima Akter", dept: "EEE", batch: "2023", img: "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=80" },
  { name: "Ariful Islam", dept: "ME", batch: "2022", img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80" },
  { name: "Rifa Akter", dept: "ChE", batch: "2024", img: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&q=80" },
  { name: "Tanvir Rahman", dept: "CE", batch: "2021", img: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=400&q=80" },
  { name: "Sajid Hasan", dept: "CSE", batch: "2023", img: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&q=80" }
];

export const StudentPortal: React.FC<StudentPortalProps> = ({ 
  addToast, 
  lang, 
  activeTab, 
  setActiveTab 
}) => {
  // --- STATE FOR DATA ---
  const [menu, setMenu] = useState<MenuItem | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, love: 0, angry: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [paymentDeadline, setPaymentDeadline] = useState<string>("");
  const [penaltyText, setPenaltyText] = useState<string>("");
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [costAnalysis, setCostAnalysis] = useState<string>("");

  // Input states
  const [commentText, setCommentText] = useState("");
  const [studentName, setStudentName] = useState("");
  const [cdDays, setCdDays] = useState("00");
  const [cdHours, setCdHours] = useState("00");
  const [cdMins, setCdMins] = useState("00");
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});

  const formattedDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Fetch Data
  useEffect(() => {
    const loadData = async () => {
      // Menu & Reactions & Comments
      const fetchedMenu = await dbService.getMenu(formattedDate);
      setMenu(fetchedMenu);

      const fetchedReactions = await dbService.getReactions(formattedDate);
      setReactions(fetchedReactions);

      const fetchedComments = await dbService.getFeedback(formattedDate);
      setComments(fetchedComments);

      // Contacts
      const fetchedContacts = await dbService.getContacts();
      setContacts(fetchedContacts);

      // Broadcasts & Notices
      const fetchedBroadcasts = await dbService.getBroadcasts();
      // Exclude expired broadcasts
      const activeBroadcasts = fetchedBroadcasts.filter(b => {
        if (!b.expiryDate) return true;
        return new Date(b.expiryDate) >= new Date();
      });
      setBroadcasts(activeBroadcasts);

      const fetchedNotice = await dbService.getNotice();
      setPaymentDeadline(fetchedNotice.paymentDeadline);
      setPenaltyText(fetchedNotice.penaltyText);

      // Managers list
      const fetchedManagers = await dbService.getManagers();
      setManagers(fetchedManagers);
      if (fetchedManagers.length > 0) {
        // Set default month to currently active manager's month
        setSelectedMonth(fetchedManagers[0].month);
      }

      // Check localStorage for prior votes
      const voteKey = `hmms_voted_${formattedDate}`;
      const votedStr = localStorage.getItem(voteKey);
      if (votedStr) {
        setHasVoted(JSON.parse(votedStr));
      }

      // Simulated Cost Analysis (Toggleable from Manager)
      const isAnalysisEnabled = localStorage.getItem(`hmms_publish_analysis_${formattedDate}`) === "true";
      if (isAnalysisEnabled) {
        setCostAnalysis(
          lang === "en" 
            ? "Today's dining mess represents an optimal spend. Protein-to-carbohydrate cost ratio is within standard bounds. Inventory level is highly optimized with zero wastage reported."
            : "আজকের ডাইনিং মেসের খরচ অত্যন্ত অপ্টিমাইজড। প্রোটিন ও শর্করার মূল্যের অনুপাত আদর্শ সীমার মধ্যে রয়েছে। ইনভেন্টরি লেভেল এবং অপচয় শূন্যের কোটায়।"
        );
      }
    };

    loadData();
  }, [formattedDate, lang]);

  // Countdown Timer ticking
  useEffect(() => {
    if (!paymentDeadline) return;

    const interval = setInterval(() => {
      const target = new Date(paymentDeadline).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        setCdDays("00");
        setCdHours("00");
        setCdMins("00");
        clearInterval(interval);
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        setCdDays(String(d).padStart(2, "0"));
        setCdHours(String(h).padStart(2, "0"));
        setCdMins(String(m).padStart(2, "0"));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [paymentDeadline]);

  // Handle Emoji Click
  const handleReaction = async (type: "like" | "love" | "angry") => {
    if (hasVoted[type]) {
      addToast(
        lang === "en" 
          ? "You have already submitted this reaction today." 
          : "আপনি আজকে ইতিমধ্যে এই প্রতিক্রিয়াটি জমা দিয়েছেন।", 
        "info"
      );
      return;
    }

    // Optimistic UI update
    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));

    const updatedVoted = { ...hasVoted, [type]: true };
    setHasVoted(updatedVoted);
    localStorage.setItem(`hmms_voted_${formattedDate}`, JSON.stringify(updatedVoted));

    try {
      await dbService.addReaction(formattedDate, type);
      addToast(
        lang === "en" ? "Reaction submitted successfully!" : "প্রতিক্রিয়া সফলভাবে জমা হয়েছে!", 
        "success"
      );
    } catch {
      addToast(
        lang === "en" ? "Failed to record reaction." : "প্রতিক্রিয়া রেকর্ড করতে ব্যর্থ হয়েছে।", 
        "error"
      );
    }
  };

  // Submit Comments
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const newComment = await dbService.addFeedback(formattedDate, commentText, studentName);
      setComments(prev => [newComment, ...prev]);
      setCommentText("");
      setStudentName("");
      addToast(
        lang === "en" ? "Comment submitted anonymously!" : "মন্তব্য বেনামে সফলভাবে জমা হয়েছে!", 
        "success"
      );
    } catch {
      addToast(
        lang === "en" ? "Failed to submit comment." : "মন্তব্য জমা দিতে ব্যর্থ হয়েছে।", 
        "error"
      );
    }
  };

  // Page Transition variants
  const tabContentVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -16, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-background pb-16 relative z-10">
      {/* Broadcast Banners */}
      <AnimatePresence>
        {broadcasts.length > 0 && (
          <div className="w-full bg-primary text-primary-foreground relative z-20">
            {broadcasts.map(b => (
              <motion.div 
                key={b.id} 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-auto max-w-7xl px-4 py-3.5 flex items-center gap-3 text-xs sm:text-sm font-semibold border-b border-background/10"
              >
                <AlertCircle size={16} className="shrink-0 animate-bounce" />
                <span className="flex-1">
                  <strong>{b.title}:</strong> {b.body}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main Student Portal Router */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* ==========================================
                1. HOME (HERO LANDING) TAB
                ========================================== */}
            {activeTab === "home" && (
              <section className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] text-center py-12">
                <div className="ornament-line w-[180px] h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent mb-7" />
                
                <div className="crest w-[72px] h-[72px] border-2 border-primary rounded-full flex items-center justify-center mb-5 relative before:content-[''] before:absolute before:-inset-[6px] before:rounded-full before:border before:border-primary/20 animate-spin-slow">
                  <div className="font-serif text-3xl font-bold text-primary leading-none">শ</div>
                </div>

                <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary/80 px-4">
                  {lang === "en" 
                    ? "Bangladesh University of Engineering and Technology" 
                    : "বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়"}
                </div>

                <h1 className="mt-4 font-serif text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-foreground leading-none">
                  <span className="text-primary block">
                    {lang === "en" ? "Sher-E-Bangla" : "শেরে বাংলা"}
                  </span>
                  <span className="font-serif italic text-transparent block mt-2" style={{ WebkitTextStroke: "1px hsl(var(--primary))" }}>
                    {lang === "en" ? "Hall of Residence" : "হল অব রেসিডেন্স"}
                  </span>
                </h1>

                <p className="mt-4 text-xs sm:text-sm text-foreground/60 tracking-[0.12em] uppercase font-mono">
                  {lang === "en" 
                    ? "Established 1973 · 487 Residents · BUET Campus" 
                    : "প্রতিষ্ঠিত ১৯৭৩ · ৪৮৭ আবাসিক ছাত্র · বুয়েট ক্যাম্পাস"}
                </p>

                <div className="ornament">
                  <div className="ornament-line"></div>
                  <div className="ornament-diamond"></div>
                  <div className="ornament-line"></div>
                </div>

                <p className="max-w-[580px] mx-auto text-sm sm:text-base text-foreground/75 leading-relaxed px-4">
                  {lang === "en" 
                    ? "Transparent dining management system. Daily menus, financial accountability, student feedback, and community engagement — all digitized."
                    : "স্বচ্ছ খাবার ব্যবস্থাপনা প্রণালী। দৈনিক খাবার তালিকা, আর্থিক হিসাবের স্বচ্ছতা, ছাত্রদের মতামত এবং সামাজিক সম্পৃক্ততা — সবকিছুই এক জায়গায় ডিজিটাল উপায়ে।"}
                </p>

                <div className="mt-8 flex gap-4 justify-center flex-wrap">
                  <button 
                    onClick={() => setActiveTab("gallery")}
                    className="px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-primary/90 text-background shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
                  >
                    {lang === "en" ? "📸 View Gallery" : "📸 গ্যালারি দেখুন"}
                  </button>
                  <button 
                    onClick={() => setActiveTab("menu")}
                    className="px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-wider border border-white/20 text-foreground hover:bg-white/5 hover:border-primary hover:text-primary transition-all"
                  >
                    {lang === "en" ? "🍽️ Today's Menu" : "🍽️ আজকের মেনু"}
                  </button>
                </div>

                <div className="mt-16 flex gap-8 sm:gap-16 justify-center flex-wrap border-t border-white/5 pt-8 w-full max-w-4xl px-4">
                  <div className="text-center">
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-primary font-mono">487</div>
                    <div className="text-[10px] text-foreground/50 tracking-wider uppercase mt-1">
                      {lang === "en" ? "Students" : "শিক্ষার্থী"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-primary font-mono">12</div>
                    <div className="text-[10px] text-foreground/50 tracking-wider uppercase mt-1">
                      {lang === "en" ? "Photos" : "ছবি"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-primary font-mono">4</div>
                    <div className="text-[10px] text-foreground/50 tracking-wider uppercase mt-1">
                      {lang === "en" ? "Managers" : "ম্যানেজার"}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-serif text-3xl sm:text-4xl font-bold text-primary font-mono">53</div>
                    <div className="text-[10px] text-foreground/50 tracking-wider uppercase mt-1">
                      {lang === "en" ? "Years" : "বছর"}
                    </div>
                  </div>
                </div>

                <div className="ornament-line w-[180px] h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent mt-8" />
              </section>
            )}

            {/* ==========================================
                2. GALLERY TAB
                ========================================== */}
            {activeTab === "gallery" && (
              <section className="pt-10">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Hall Memories" : "হলের স্মৃতি"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Hall " : "হল "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Gallery" : "গ্যালারি"}</em>
                  </h2>
                  <p className="max-w-[600px] mx-auto text-xs sm:text-sm text-foreground/50 mt-4 leading-relaxed">
                    {lang === "en" 
                      ? "Beautiful moments captured by our hall residents. Each photo tells a story of life, friendship, and community at Sher-E-Bangla Hall."
                      : "আমাদের হলবাসীদের ক্যামেরায় বন্দী চমৎকার কিছু মুহূর্ত। প্রতিটি ছবি শেরে বাংলা হলের জীবন, বন্ধুত্ব এবং সৌহার্দ্যের গল্প বলে।"}
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {GALLERY_ITEMS.map((item, idx) => (
                    <div key={idx} className="group relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/5 hover:border-primary/30 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1 transition-all duration-300">
                      <div className="h-60 overflow-hidden relative">
                        <img 
                          src={item.img} 
                          alt={item.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-75" />
                      </div>
                      <div className="p-5">
                        <h4 className="font-serif text-base font-bold text-foreground">{item.name}</h4>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                            {item.dept}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            Batch {item.batch}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ==========================================
                3. TODAY'S MENU TAB
                ========================================== */}
            {activeTab === "menu" && (
              <section className="pt-10">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Daily Update" : "দৈনিক আপডেট"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Today's " : "আজকের "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Menu" : "মেনু"}</em>
                  </h2>
                  <p className="text-xs sm:text-sm text-foreground/50 mt-3 font-mono">
                    {new Date().toLocaleDateString(lang === "en" ? "en-US" : "bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                  {/* Left Column: Menus & Feedback */}
                  <div className="lg:col-span-2 space-y-8">
                    {/* Menu grid */}
                    <div className="grid gap-6 sm:grid-cols-3">
                      {/* Breakfast Card */}
                      <div className="group rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] shadow-lg">
                        <div className="h-44 overflow-hidden relative">
                          <img 
                            src="https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=300&q=80" 
                            alt="Breakfast" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-400 backdrop-blur-md">
                            {lang === "en" ? "Breakfast" : "সকালের নাস্তা"}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="font-serif text-lg font-bold text-foreground">Morning Fuel</h4>
                          <p className="mt-2 text-xs text-foreground/70 leading-relaxed min-h-[50px]">
                            {menu?.breakfast || (lang === "en" ? "No breakfast logged today." : "আজকে সকালের নাস্তা লিপিবদ্ধ করা হয়নি।")}
                          </p>
                        </div>
                      </div>

                      {/* Lunch Card */}
                      <div className="group rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] shadow-lg">
                        <div className="h-44 overflow-hidden relative">
                          <img 
                            src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80" 
                            alt="Lunch" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 backdrop-blur-md">
                            {lang === "en" ? "Lunch" : "দুপুরের খাবার"}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="font-serif text-lg font-bold text-foreground">Afternoon Feast</h4>
                          <p className="mt-2 text-xs text-foreground/70 leading-relaxed min-h-[50px]">
                            {menu?.lunch || (lang === "en" ? "No lunch logged today." : "আজকে দুপুরের খাবার লিপিবদ্ধ করা হয়নি।")}
                          </p>
                        </div>
                      </div>

                      {/* Dinner Card */}
                      <div className="group rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] shadow-lg">
                        <div className="h-44 overflow-hidden relative">
                          <img 
                            src="https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80" 
                            alt="Dinner" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 border border-sky-500/40 text-sky-400 backdrop-blur-md">
                            {lang === "en" ? "Dinner" : "রাতের খাবার"}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="font-serif text-lg font-bold text-foreground">Night Delight</h4>
                          <p className="mt-2 text-xs text-foreground/70 leading-relaxed min-h-[50px]">
                            {menu?.dinner || (lang === "en" ? "No dinner logged today." : "আজকে রাতের খাবার লিপিবদ্ধ করা হয়নি।")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Estimations and AI insights */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {lang === "en" ? "Estimated Budget" : "আনুমানিক বাজেট"}
                        </span>
                        <h5 className="text-sm font-semibold text-foreground/80 mt-0.5">
                          {lang === "en" ? "Cost per Resident Student" : "আবাসিক ছাত্র প্রতি আনুমানিক ব্যয়"}
                        </h5>
                      </div>
                      <span className="text-xl font-mono font-bold text-primary self-center">
                        {menu?.estimatedCost 
                          ? `${menu.estimatedCost} BDT` 
                          : (lang === "en" ? "Unavailable" : "অপ্রাপ্য")}
                      </span>
                    </div>

                    {costAnalysis && (
                      <div className="p-5 rounded-2xl bg-primary/5 border border-primary/20 relative overflow-hidden">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {lang === "en" ? "AI Cost Analysis Insight" : "কৃত্রিম বুদ্ধিমত্তা খরচ বিশ্লেষণ"}
                        </span>
                        <p className="mt-2 text-xs sm:text-sm text-foreground/80 leading-relaxed">{costAnalysis}</p>
                      </div>
                    )}

                    {/* Feedback Form */}
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl">
                      <h3 className="text-xl font-serif font-bold text-foreground flex items-center gap-2">
                        <MessageSquare size={20} className="text-primary" />
                        {lang === "en" ? "Anonymous Feedback Room" : "বেনামী মন্তব্য কক্ষ"}
                      </h3>
                      <p className="text-xs text-foreground/50 mt-1">
                        {lang === "en" 
                          ? "Share your honest reviews about dining service. Submissions are anonymous." 
                          : "খাবারের মান নিয়ে আপনার সৎ প্রতিক্রিয়া শেয়ার করুন। সকল তথ্য গোপন রাখা হবে।"}
                      </p>

                      <form onSubmit={handleCommentSubmit} className="space-y-4 mt-6">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold uppercase text-foreground/40 mb-1">
                              {lang === "en" ? "Your Feedback" : "আপনার প্রতিক্রিয়া"}
                            </label>
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder={lang === "en" ? "Review the flavor, temperature or serving..." : "খাবারের স্বাদ, পরিবেশন বা তাপমাত্রা সম্পর্কে লিখুন..."}
                              className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 resize-none h-20 placeholder:text-foreground/30"
                              required
                            />
                          </div>
                          <div className="flex flex-col justify-between">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-foreground/40 mb-1">
                                {lang === "en" ? "Alias (Optional)" : "ছদ্মনাম (ঐচ্ছিক)"}
                              </label>
                              <input
                                type="text"
                                value={studentName}
                                onChange={(e) => setStudentName(e.target.value)}
                                placeholder="e.g. AnonRoom204"
                                className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-sm focus:outline-none focus:border-primary/50 placeholder:text-foreground/30"
                              />
                            </div>
                            <button
                              type="submit"
                              className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/95 text-background hover:scale-102 px-4 py-3 rounded-xl text-xs font-bold tracking-wide uppercase transition-all"
                            >
                              <Send size={12} />
                              {lang === "en" ? "Submit" : "জমা দিন"}
                            </button>
                          </div>
                        </div>
                      </form>

                      {/* Comments Feed */}
                      <div className="mt-8 space-y-4 border-t border-white/5 pt-6">
                        {comments.length === 0 ? (
                          <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl text-xs text-foreground/45">
                            {lang === "en" ? "No comments logged for today's meals yet." : "আজকের খাবার সম্পর্কে এখনো কোনো প্রতিক্রিয়া নেই।"}
                          </div>
                        ) : (
                          comments.map(c => (
                            <div 
                              key={c.id} 
                              className={`p-4 rounded-xl border transition-all duration-300 ${
                                c.highlighted 
                                  ? "bg-primary/5 border-primary/30" 
                                  : "bg-white/[0.01] border-white/5"
                              }`}
                            >
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-foreground/90 flex items-center gap-1.5">
                                  <User size={12} className="text-primary/75" />
                                  {c.name || (lang === "en" ? "Anonymous Student" : "বেনামী ছাত্র")}
                                </span>
                                <span className="text-[10px] text-foreground/40 font-mono flex items-center gap-1">
                                  <Clock size={10} />
                                  {new Date(c.timestamp).toLocaleTimeString(lang === "en" ? "en-US" : "bn-BD", { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="mt-2 text-xs sm:text-sm text-foreground/75 leading-relaxed pl-5">
                                {c.text}
                              </p>
                              {c.highlighted && (
                                <span className="inline-block mt-2 ml-5 text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                  {lang === "en" ? "Highlighted by Mess Manager" : "ম্যানেজার দ্বারা হাইলাইটেড"}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Poll & Active Managers */}
                  <div className="space-y-6">
                    {/* Emoji Reaction poll */}
                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] shadow-lg">
                      <h3 className="text-lg font-serif font-bold text-foreground">
                        {lang === "en" ? "Daily Menu Poll" : "খাবারের ভোট"}
                      </h3>
                      <p className="text-xs text-foreground/50 mt-1">
                        {lang === "en" ? "Submit anonymous reactions for today's food selections." : "আজকের খাবারের মানের ওপর বেনামে আপনার ভোট দিন।"}
                      </p>

                      <div className="grid grid-cols-3 gap-3 mt-6">
                        {/* Like */}
                        <button
                          onClick={() => handleReaction("like")}
                          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                            hasVoted["like"]
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-white/[0.03] border-white/5 text-foreground/60 hover:text-foreground hover:border-primary/25"
                          }`}
                        >
                          <ThumbsUp size={20} className="mb-2" />
                          <span className="text-sm font-bold font-mono">{reactions.like || 0}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-1">
                            {lang === "en" ? "Like" : "পছন্দ"}
                          </span>
                        </button>

                        {/* Love */}
                        <button
                          onClick={() => handleReaction("love")}
                          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                            hasVoted["love"]
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-white/[0.03] border-white/5 text-foreground/60 hover:text-foreground hover:border-primary/25"
                          }`}
                        >
                          <Heart size={20} className="mb-2" />
                          <span className="text-sm font-bold font-mono">{reactions.love || 0}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-1">
                            {lang === "en" ? "Love" : "দারুণ"}
                          </span>
                        </button>

                        {/* Angry */}
                        <button
                          onClick={() => handleReaction("angry")}
                          className={`flex flex-col items-center p-4 rounded-xl border transition-all ${
                            hasVoted["angry"]
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-white/[0.03] border-white/5 text-foreground/60 hover:text-foreground hover:border-primary/25"
                          }`}
                        >
                          <Angry size={20} className="mb-2" />
                          <span className="text-sm font-bold font-mono">{reactions.angry || 0}</span>
                          <span className="text-[9px] font-bold uppercase tracking-wider mt-1">
                            {lang === "en" ? "Angry" : "অপছন্দ"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Active Managers Panel */}
                    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] shadow-lg">
                      <h3 className="text-lg font-serif font-bold text-foreground">
                        {lang === "en" ? "Active Managers" : "চলতি মেসের পরিচালক"}
                      </h3>
                      <div className="space-y-4 mt-4">
                        {managers.filter(m => m.month === "May 2026").map(m => (
                          <div key={m.id} className="flex items-center gap-3">
                            <img 
                              src={m.photoUrl} 
                              alt={m.name} 
                              className="h-10 w-10 rounded-xl object-cover border border-white/10"
                            />
                            <div>
                              <span className="block text-xs font-bold text-foreground">{m.name}</span>
                              <span className="block text-[10px] text-foreground/45">ID: {m.id} ({m.dept})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveTab("managers")}
                        className="mt-6 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        {lang === "en" ? "Browse Managers Directory" : "সকল পরিচালকদের তালিকা"}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ==========================================
                4. NOTICES & DEADLINES TAB
                ========================================== */}
            {activeTab === "notices" && (
              <section className="pt-10">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Updates & Announcements" : "ঘোষণা ও নোটিশ"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Notices & " : "নোটিশ ও "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Deadlines" : "সময়সীমা"}</em>
                  </h2>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                  {/* Notice Timelines */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl">
                      <h3 className="text-xl font-serif font-bold text-foreground mb-6">
                        {lang === "en" ? "General Notices" : "সাধারণ নোটিশ সমূহ"}
                      </h3>
                      
                      <div className="relative border-l border-white/10 pl-6 ml-3 space-y-8">
                        {broadcasts.length === 0 ? (
                          <div className="text-center py-6 text-xs text-foreground/40">
                            {lang === "en" ? "No active bulletins logged on the notice board." : "নোটিশ বোর্ডে কোনো সক্রিয় ঘোষণা নেই।"}
                          </div>
                        ) : (
                          broadcasts.map(notice => (
                            <div key={notice.id} className="relative group">
                              {/* Timeline Point */}
                              <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-background group-hover:scale-110 transition-transform duration-150" />
                              
                              <div>
                                <span className="text-[10px] font-bold text-primary flex items-center gap-1 font-mono">
                                  <Calendar size={10} />
                                  {lang === "en" ? "Published: " : "প্রকাশিত: "}{notice.publishDate}
                                </span>
                                <h4 className="mt-1 text-base font-bold text-foreground">{notice.title}</h4>
                                <p className="mt-2 text-xs sm:text-sm text-foreground/60 leading-relaxed">{notice.body}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Deadlines Timer panel */}
                  <div className="space-y-6">
                    <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-rose-500/10 via-rose-500/[0.02] to-transparent border border-rose-500/30 relative overflow-hidden shadow-lg">
                      <div className="absolute -right-5 -top-5 font-serif font-bold text-9xl text-rose-500/[0.04] pointer-events-none select-none">
                        ৳
                      </div>
                      
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                        {lang === "en" ? "💰 Monthly Mess Fee" : "💰 মাসিক মেস ফি"}
                      </span>
                      
                      <div className="mt-3 font-serif text-5xl font-bold text-foreground">
                        <span className="text-xl align-super mr-0.5">৳</span>2,500
                      </div>
                      
                      <p className="mt-2 text-xs text-foreground/50">
                        {lang === "en" ? "Submit to Avoid Penalties" : "জরিমানা এড়াতে নির্ধারিত সময়ে পরিশোধ করুন"}
                      </p>

                      {/* Countdown Boxes */}
                      <div className="flex gap-3 mt-6">
                        <div className="flex-1 text-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          <div className="font-serif text-2xl font-bold text-rose-500 font-mono">{cdDays}</div>
                          <div className="text-[9px] text-foreground/40 uppercase font-semibold mt-1">
                            {lang === "en" ? "Days" : "দিন"}
                          </div>
                        </div>
                        <div className="flex-1 text-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          <div className="font-serif text-2xl font-bold text-rose-500 font-mono">{cdHours}</div>
                          <div className="text-[9px] text-foreground/40 uppercase font-semibold mt-1">
                            {lang === "en" ? "Hours" : "ঘণ্টা"}
                          </div>
                        </div>
                        <div className="flex-1 text-center p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                          <div className="font-serif text-2xl font-bold text-rose-500 font-mono">{cdMins}</div>
                          <div className="text-[9px] text-foreground/40 uppercase font-semibold mt-1">
                            {lang === "en" ? "Mins" : "মিনিট"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 text-xs leading-relaxed text-foreground/50 border-t border-rose-500/10 pt-4">
                        <p className="font-semibold text-foreground mb-1">
                          {lang === "en" ? "Administrative Note:" : "প্রশাসনিক বার্তা:"}
                        </p>
                        <p className="italic">
                          {penaltyText || (lang === "en" ? "Payments after deadline will trigger standard penalties." : "নির্ধারিত সময়ের পরে পরিশোধ করলে জরিমানা প্রযোজ্য হবে।")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ==========================================
                5. IMPORTANT CONTACTS TAB
                ========================================== */}
            {activeTab === "contacts" && (
              <section className="pt-10">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Support Directory" : "জরুরি যোগাযোগ"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Important " : "গুরুত্বপূর্ণ "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Contacts" : "যোগাযোগ"}</em>
                  </h2>
                </div>

                {/* Provost Hero Card */}
                <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-white/[0.01] to-transparent border border-emerald-500/20 flex flex-col md:flex-row items-center gap-6 sm:gap-8 mb-8 relative overflow-hidden shadow-xl">
                  <div className="absolute right-0 top-0 w-60 h-60 rounded-full bg-emerald-500/[0.02] filter blur-2xl pointer-events-none" />
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_15px_rgba(var(--primary),0.15)] shrink-0 self-center">
                    <img 
                      src="https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=300&q=80" 
                      alt="Provost" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {lang === "en" ? "Hall Provost Office" : "হল প্রভোস্ট কার্যালয়"}
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mt-1">
                      {lang === "en" ? "Prof. Dr. Rafiqul Islam" : "অধ্যাপক ড. রফিকুল ইসলাম"}
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground/50 mt-1 font-semibold">
                      {lang === "en" ? "Professor, Civil Engineering department · BUET" : "অধ্যাপক, পুরকৌশল বিভাগ · বুয়েট"}
                    </p>
                    <p className="max-w-[560px] text-xs sm:text-sm text-foreground/60 mt-4 leading-relaxed">
                      {lang === "en" 
                        ? "Dr. Islam has been serving as provost since 2021. His commitment to student welfare and transparent governance has significantly improved hall dining mess operations."
                        : "অধ্যাপক ড. রফিকুল ইসলাম ২০২১ সাল থেকে শেরে বাংলা হলের প্রভোস্ট হিসেবে দায়িত্বে আছেন। হলের আবাসিক ছাত্রদের কল্যাণ এবং ডাইনিং ব্যবস্থাপনায় স্বচ্ছতা আনতে তার গৃহীত পদক্ষেপ সমূহ প্রশংসনীয়।"}
                    </p>
                  </div>
                </div>

                {/* Directory Contacts Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {contacts.map(c => (
                    <div 
                      key={c.id} 
                      className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/20 shadow-md flex flex-col justify-between transition-all duration-300"
                    >
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">
                          {c.role}
                        </span>
                        <h4 className="mt-1 text-base font-bold text-foreground">{c.name}</h4>
                        
                        {c.introduction && (
                          <p className="mt-2 text-xs text-foreground/50 leading-relaxed">
                            {c.introduction}
                          </p>
                        )}
                      </div>
                      
                      <a 
                        href={`tel:${c.phone}`}
                        className="mt-5 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-primary hover:text-background hover:border-transparent text-xs font-bold uppercase tracking-wider transition-all"
                      >
                        <Phone size={11} />
                        {c.phone}
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ==========================================
                6. MEET YOUR MANAGERS TAB
                ========================================== */}
            {activeTab === "managers" && (
              <section className="pt-10">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Administration Registry" : "পরিচালক ডিরেক্টরি"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Meet Your " : "মেস "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Managers" : "পরিচালকবৃন্দ"}</em>
                  </h2>
                </div>

                <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                      <h3 className="text-lg font-serif font-bold text-foreground">
                        {lang === "en" ? "Mess Managers Directory" : "ম্যানেজার অনুসন্ধান"}
                      </h3>
                      <p className="text-xs text-foreground/45 mt-0.5">
                        {lang === "en" ? "Browse assigned managers and their bios for past months." : "নির্দিষ্ট মাস নির্বাচন করে মেস ম্যানেজার ও তাদের প্রোফাইল দেখুন।"}
                      </p>
                    </div>
                    
                    {/* Month selector dropdown */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-foreground/45">
                        {lang === "en" ? "Select Month:" : "মাস নির্বাচন:"}
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-bold focus:outline-none focus:border-primary/50 text-foreground"
                      >
                        {Array.from(new Set(managers.map(m => m.month))).map(month => (
                          <option key={month} value={month} className="bg-background text-foreground">
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Managers Grid */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    {managers.filter(m => m.month === selectedMonth).map(m => (
                      <div 
                        key={m.id} 
                        className="flex flex-col sm:flex-row gap-5 p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-primary/20 transition-all duration-300"
                      >
                        <img 
                          src={m.photoUrl} 
                          alt={m.name} 
                          className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl object-cover shrink-0 border border-white/10 self-center bg-white/5"
                        />
                        
                        <div className="flex flex-col justify-center flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                            {m.month}
                          </span>
                          <h4 className="mt-1 text-base font-bold text-foreground">{m.name}</h4>
                          <div className="text-[10px] text-foreground/40 font-semibold mt-1 font-mono space-x-2">
                            <span>DEPT: {m.dept}</span>
                            <span>•</span>
                            <span>ROOM: {m.room}</span>
                          </div>
                          {m.bio && (
                            <p className="mt-3 text-xs text-foreground/60 leading-relaxed italic border-l border-primary/30 pl-2">
                              "{m.bio}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {managers.filter(m => m.month === selectedMonth).length === 0 && (
                      <div className="col-span-2 text-center py-8 text-xs text-foreground/45 border border-dashed border-white/5 rounded-2xl">
                        {lang === "en" ? "No managers registered for the selected month." : "নির্বাচিত মাসের জন্য কোনো ম্যানেজার পাওয়া যায়নি।"}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};
export default StudentPortal;
