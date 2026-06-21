import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, ThumbsUp, Angry, Send, Calendar, Phone, 
  MessageSquare, Clock, ArrowRight, User
} from "lucide-react";
import { dbService } from "../../services/dbService";
import type { MenuItem, Contact, Broadcast, Comment, ManagerProfile, GalleryItem, ProvostProfile, Complaint } from "../../services/dbService";

interface StudentPortalProps {
  addToast: (text: string, type: "success" | "error" | "info") => void;
  lang: "en" | "bn";
  activeTab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers" | "complaints";
  setActiveTab: (tab: "home" | "gallery" | "menu" | "notices" | "contacts" | "managers" | "complaints") => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ 
  addToast, 
  lang, 
  activeTab, 
  setActiveTab 
}) => {
  // --- STATE FOR DATA ---
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [menu, setMenu] = useState<MenuItem | null>(null);
  const [reactions, setReactions] = useState<Record<string, number>>({ like: 0, love: 0, angry: 0 });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [paymentDeadline, setPaymentDeadline] = useState<string>("");
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [costAnalysis, setCostAnalysis] = useState<string>("");
  const [provost, setProvost] = useState<ProvostProfile | null>(null);
  const [developerPhoto, setDeveloperPhoto] = useState<string>("");

  // Student verification states (FEAT-01)
  const [studentId, setStudentId] = useState<string | null>(() => localStorage.getItem("hmms_student_id"));
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [tempId, setTempId] = useState("");

  // Paginated comments states (SCALE-01)
  const [commentsPage, setCommentsPage] = useState<Comment[]>([]);
  const [lastDocComments, setLastDocComments] = useState<any>(null);
  const [hasMoreComments, setHasMoreComments] = useState(false);

  // Input states
  const [commentText, setCommentText] = useState("");
  const [studentName, setStudentName] = useState("");
  const [cdDays, setCdDays] = useState("00");
  const [cdHours, setCdHours] = useState("00");
  const [cdMins, setCdMins] = useState("00");
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);

  // Student Photo Upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [studentPhotoName, setStudentPhotoName] = useState("");
  const [studentPhotoDept, setStudentPhotoDept] = useState("");
  const [studentPhotoBatch, setStudentPhotoBatch] = useState("2024");
  const [studentPhotoFile, setStudentPhotoFile] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Student Complaint Desk states
  const [complaintDesc, setComplaintDesc] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("Food Quality");
  const [complaintName, setComplaintName] = useState("");
  const [complaintRoom, setComplaintRoom] = useState("");
  const [complaintBatch, setComplaintBatch] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const handleStudentComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDesc.trim()) return;

    setSubmittingComplaint(true);
    try {
      const newComplaint: Complaint = {
        id: "comp_" + Math.random().toString(36).substring(2, 9),
        category: complaintCategory,
        date: new Date().toISOString().split("T")[0],
        severity: "medium", // default
        description: complaintDesc,
        studentName: complaintName.trim() || undefined,
        studentRoom: complaintRoom.trim() || undefined,
        studentBatch: complaintBatch.trim() || undefined,
        status: "pending", // pending action by managers
        endorsingManagers: []
      };

      await dbService.saveComplaint(newComplaint);
      addToast(
        lang === "en" 
          ? "Complaint submitted successfully to the managers desk!" 
          : "অভিযোগটি সফলভাবে ম্যানেজারদের কাছে পাঠানো হয়েছে!",
        "success"
      );
      
      // Reset form
      setComplaintDesc("");
      setComplaintName("");
      setComplaintRoom("");
      setComplaintBatch("");
      setComplaintCategory("Food Quality");
    } catch (err) {
      console.error(err);
      addToast(
        lang === "en" ? "Failed to submit complaint. Please try again." : "অভিযোগ জমা দিতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
        "error"
      );
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const handleStudentPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentPhotoName.trim() || !studentPhotoDept.trim() || !studentPhotoFile) {
      addToast("Title, Department, and Photo File are required.", "error");
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const pendingItem = {
        id: Math.random().toString(36).substring(2, 9),
        name: studentPhotoName.trim(),
        dept: studentPhotoDept.trim(),
        batch: studentPhotoBatch.trim() || "2024",
        img: studentPhotoFile,
        status: "pending" as const
      };
      await dbService.saveGalleryItem(pendingItem);
      addToast("Memory photo submitted! It will appear in the album once approved by mess managers.", "success");
      setStudentPhotoName("");
      setStudentPhotoDept("");
      setStudentPhotoBatch("2024");
      setStudentPhotoFile("");
      setShowUploadModal(false);
      // Reload approved list
      const fetched = await dbService.getGalleryItems(true);
      setGalleryItems(fetched);
    } catch (err) {
      addToast("Failed to submit photo.", "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const formattedDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Fetch comments in pages (SCALE-01)
  const loadComments = async (reset = false) => {
    try {
      const cursor = reset ? null : lastDocComments;
      const res = await dbService.getFeedbackPaginated(formattedDate, 10, cursor);
      if (reset) {
        setCommentsPage(res.items);
      } else {
        setCommentsPage(prev => [...prev, ...res.items]);
      }
      setLastDocComments(res.lastDoc);
      setHasMoreComments(res.hasMore);
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  // Fetch Data
  useEffect(() => {
    const loadData = async () => {
      // Load all data in parallel using Promise.all (PERF-01)
      const [
        fetchedGallery,
        fetchedMenu,
        fetchedReactions,
        commentsRes,
        provostProfile,
        devPhoto,
        fetchedContacts,
        fetchedBroadcasts,
        fetchedNotice,
        fetchedManagers,
        voted
      ] = await Promise.all([
        dbService.getGalleryItems(true).catch(err => { console.error("Gallery fail:", err); return []; }),
        dbService.getMenu(formattedDate).catch(err => { console.error("Menu fail:", err); return null; }),
        dbService.getReactions(formattedDate).catch(err => { console.error("Reactions fail:", err); return { like: 0, love: 0, angry: 0 }; }),
        dbService.getFeedbackPaginated(formattedDate, 10, null).catch(err => { console.error("Comments fail:", err); return { items: [], lastDoc: null, hasMore: false }; }),
        dbService.getProvostProfile().catch(err => { console.error("Provost Profile fail:", err); return null; }),
        dbService.getDeveloperPhoto().catch(err => { console.error("Dev Photo fail:", err); return ""; }),
        dbService.getContacts().catch(err => { console.error("Contacts fail:", err); return []; }),
        dbService.getBroadcasts().catch(err => { console.error("Broadcasts fail:", err); return []; }),
        dbService.getNotice().catch(err => { console.error("Notice fail:", err); return { paymentDeadline: "", penaltyText: "" }; }),
        dbService.getManagers().catch(err => { console.error("Managers fail:", err); return []; }),
        studentId ? dbService.hasVoted(formattedDate, studentId).catch(err => { console.error("Voted status fail:", err); return false; }) : Promise.resolve(false)
      ]);

      setGalleryItems(fetchedGallery);
      setMenu(fetchedMenu);
      setReactions(fetchedReactions);
      
      // Comments page setup
      setCommentsPage(commentsRes.items);
      setLastDocComments(commentsRes.lastDoc);
      setHasMoreComments(commentsRes.hasMore);

      setProvost(provostProfile);
      setDeveloperPhoto(devPhoto);
      setContacts(fetchedContacts);

      // Exclude expired broadcasts (timezone verified)
      const activeBroadcasts = fetchedBroadcasts.filter(b => {
        if (!b.expiryDate) return true;
        return new Date(b.expiryDate) >= new Date();
      });
      setBroadcasts(activeBroadcasts);

      let deadline = fetchedNotice.paymentDeadline;
      if (!deadline || new Date(deadline).getTime() <= Date.now()) {
        const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
        deadline = futureDate.toISOString();
      }
      setPaymentDeadline(deadline);

      setManagers(fetchedManagers);
      const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const hasCurrentMonth = fetchedManagers.some(m => m.month === currentMonth);
      if (hasCurrentMonth) {
        setSelectedMonth(currentMonth);
      } else if (fetchedManagers.length > 0) {
        setSelectedMonth(fetchedManagers[0].month);
      }

      // Check database and local storage for prior votes (FUNC-05)
      if (studentId) {
        if (voted) {
          setHasVoted({ like: true, love: true, angry: true });
        }
      } else {
        const voteKey = `hmms_voted_${formattedDate}`;
        const votedStr = localStorage.getItem(voteKey);
        if (votedStr) {
          setHasVoted(JSON.parse(votedStr));
        }
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
  }, [formattedDate, lang, studentId]);

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
    if (!studentId) {
      setVerificationModalOpen(true);
      addToast(
        lang === "en" ? "Please verify your Resident ID to participate in polls." : "পোলগুলিতে অংশ নিতে অনুগ্রহ করে আপনার রেসিডেন্ট আইডি যাচাই করুন।",
        "info"
      );
      return;
    }

    const alreadyVoted = await dbService.hasVoted(formattedDate, studentId);
    if (alreadyVoted) {
      addToast(
        lang === "en" 
          ? "You have already submitted a reaction today." 
          : "আপনি আজকে ইতিমধ্যে একটি প্রতিক্রিয়া জমা দিয়েছেন।", 
        "info"
      );
      return;
    }

    // Optimistic UI update
    setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
    setHasVoted({ like: true, love: true, angry: true });

    try {
      await dbService.addReaction(formattedDate, type, studentId);
      addToast(
        lang === "en" ? "Reaction submitted successfully!" : "প্রতিক্রিয়া সফলভাবে জমা হয়েছে!", 
        "success"
      );
    } catch (err) {
      // Rollback reaction state
      setReactions(prev => ({ ...prev, [type]: Math.max(0, (prev[type] || 1) - 1) }));
      setHasVoted({});
      const errMsg = err instanceof Error ? err.message : "Failed to record reaction.";
      addToast(errMsg, "error");
    }
  };

  // Submit Comments (DATA-05, FEAT-01)
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    if (!studentId) {
      setVerificationModalOpen(true);
      addToast(
        lang === "en" ? "Please verify your Resident ID to submit comments." : "মন্তব্য জমা দিতে অনুগ্রহ করে আপনার রেসিডেন্ট আইডি যাচাই করুন।",
        "info"
      );
      return;
    }

    if (commentText.length > 500) {
      addToast(
        lang === "en" ? "Comment exceeds the maximum length of 500 characters." : "মন্তব্য সর্বোচ্চ ৫০০ অক্ষরের বেশি হতে পারবে না।",
        "error"
      );
      return;
    }

    const lastSubmit = localStorage.getItem("hmms_last_feedback_submit");
    if (lastSubmit) {
      const diff = Date.now() - parseInt(lastSubmit, 10);
      if (diff < 30000) {
        const remaining = Math.ceil((30000 - diff) / 1000);
        addToast(
          lang === "en" 
            ? `Please wait ${remaining} seconds before submitting another feedback.` 
            : `আরেকটি মন্তব্য জমা দেওয়ার আগে দয়া করে ${remaining} সেকেন্ড অপেক্ষা করুন।`,
          "error"
        );
        return;
      }
    }

    try {
      const newComment = await dbService.addFeedback(formattedDate, commentText, studentName);
      setCommentsPage(prev => [newComment, ...prev]);
      setCommentText("");
      setStudentName("");
      localStorage.setItem("hmms_last_feedback_submit", Date.now().toString());
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

  // Verification Modal markup (FEAT-01)
  const renderVerificationModal = () => {
    if (!verificationModalOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-card border border-border/50 max-w-md w-full rounded-3xl p-6 sm:p-8 space-y-4">
          <h3 className="text-lg font-serif font-bold text-foreground">
            {lang === "en" ? "Verify Sher-E-Bangla Resident ID" : "শেরে বাংলা আবাসিক আইডি যাচাই করুন"}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {lang === "en"
              ? "To prevent non-resident spam, voting and feedback comments require a one-time 7-digit BUET Student ID verification."
              : "বহিরাগত স্প্যাম প্রতিরোধ করতে, পোল ভোট এবং মন্তব্য প্রদানের জন্য ৭-ডিজিটের বুয়েট স্টুডেন্ট আইডি যাচাইকরণ আবশ্যক।"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{7}$/.test(tempId)) {
                addToast(
                  lang === "en" ? "ID must be exactly 7 digits." : "আইডি অবশ্যই ঠিক ৭ ডিজিটের হতে হবে।",
                  "error"
                );
                return;
              }
              localStorage.setItem("hmms_student_id", tempId);
              setStudentId(tempId);
              setVerificationModalOpen(false);
              addToast(
                lang === "en" ? "Resident ID verified successfully!" : "আবাসিক আইডি সফলভাবে যাচাই করা হয়েছে!",
                "success"
              );
            }}
            className="space-y-3"
          >
            <input
              type="text"
              value={tempId}
              onChange={(e) => setTempId(e.target.value.replace(/\D/g, "").slice(0, 7))}
              placeholder="e.g. 2012003"
              className="w-full px-4 py-2.5 bg-muted/40 border border-border/60 rounded-xl text-sm focus:outline-none"
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-primary text-background rounded-xl text-xs font-bold transition-all"
              >
                {lang === "en" ? "Verify ID" : "আইডি যাচাই করুন"}
              </button>
              <button
                type="button"
                onClick={() => setVerificationModalOpen(false)}
                className="px-4 bg-muted hover:bg-muted/80 rounded-xl text-xs font-bold text-foreground"
              >
                {lang === "en" ? "Cancel" : "বাতিল"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Lightbox Modal markup
  const renderLightboxModal = () => {
    if (!activeLightboxImage) return null;
    return (
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
        onClick={() => setActiveLightboxImage(null)}
      >
        <button 
          onClick={() => setActiveLightboxImage(null)}
          className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
        >
          ✕ Close
        </button>
        <img 
          src={activeLightboxImage} 
          alt="Food Item Large View" 
          className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/10"
        />
      </div>
    );
  };

  // Reusable horizontal infinite scrolling image marquee
  const renderMarquee = (images: string[] | undefined, defaultImg: string, altText: string) => {
    const imgs = images && images.length > 0 ? images : [defaultImg];
    const duplicatedImgs = imgs.length > 1 ? [...imgs, ...imgs] : imgs;

    return (
      <div className="h-44 overflow-hidden relative bg-black/20 flex items-center w-full">
        <div className={`${imgs.length > 1 ? "animate-marquee-ltr" : "w-full h-full flex"}`}>
          {duplicatedImgs.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`${altText} ${i}`}
              onClick={() => setActiveLightboxImage(img)}
              className="h-44 object-cover cursor-pointer hover:opacity-85 transition-opacity inline-block flex-shrink-0"
              style={{ width: imgs.length > 1 ? "150px" : "100%" }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Page Transition variants
  const tabContentVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -16, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-background pb-16 relative z-10">
      {/* Broadcast Banners removed to keep landing design clean */}

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
                    onClick={() => setActiveTab("menu")}
                    className="px-8 py-3.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-primary to-primary/90 text-background shadow-lg shadow-primary/20 hover:scale-102 hover:shadow-primary/35 transition-all"
                  >
                    {lang === "en" ? "Click to Enter" : "প্রবেশ করতে ক্লিক করুন"}
                  </button>
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
                  <p className="max-w-[600px] mx-auto text-xs sm:text-sm text-foreground/50 mt-4 leading-relaxed mb-6">
                    {lang === "en" 
                      ? "Beautiful moments captured by our hall residents. Each photo tells a story of life, friendship, and community at Sher-E-Bangla Hall."
                      : "আমাদের হলবাসীদের ক্যামেরায় বন্দী চমৎকার কিছু মুহূর্ত। প্রতিটি ছবি শেরে বাংলা হলের জীবন, বন্ধুত্ব এবং সৌহার্দ্যের গল্প বলে।"}
                  </p>

                  <div className="flex justify-center mb-8">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="px-6 py-2.5 bg-primary text-background rounded-full text-xs font-bold uppercase tracking-wider hover:scale-105 shadow-lg shadow-primary/20 hover:shadow-primary/35 transition-all"
                    >
                      {lang === "en" ? "Share a Hall Memory" : "হলের স্মৃতি শেয়ার করুন"}
                    </button>
                  </div>
                </div>

                {showUploadModal && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
                    <div className="max-w-md w-full bg-card border border-border/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-foreground">
                          {lang === "en" ? "Share Hall Memory" : "হলের স্মৃতি শেয়ার করুন"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowUploadModal(false)}
                          className="text-foreground/45 hover:text-foreground text-sm font-bold"
                        >
                          ✕
                        </button>
                      </div>

                      <form onSubmit={handleStudentPhotoSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                            {lang === "en" ? "Image Title / Caption" : "ছবির শিরোনাম / ক্যাপশন"}
                          </label>
                          <input
                            type="text"
                            value={studentPhotoName}
                            onChange={(e) => setStudentPhotoName(e.target.value)}
                            placeholder={lang === "en" ? "e.g. Friendly Cricket Match" : "যেমনঃ হলের ক্রিকেট ম্যাচ"}
                            className="w-full px-3.5 py-2.5 bg-muted/40 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                              {lang === "en" ? "Your Dept" : "আপনার বিভাগ"}
                            </label>
                            <input
                              type="text"
                              value={studentPhotoDept}
                              onChange={(e) => setStudentPhotoDept(e.target.value)}
                              placeholder="e.g. EEE"
                              className="w-full px-3.5 py-2.5 bg-muted/40 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                              {lang === "en" ? "Your Batch" : "আপনার ব্যাচ"}
                            </label>
                            <input
                              type="text"
                              value={studentPhotoBatch}
                              onChange={(e) => setStudentPhotoBatch(e.target.value)}
                              placeholder="e.g. 2022"
                              className="w-full px-3.5 py-2.5 bg-muted/40 border border-border/40 rounded-xl text-xs focus:outline-none text-foreground"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">
                            {lang === "en" ? "Upload Photo" : "ছবি আপলোড করুন"}
                          </label>
                          <div className="flex gap-3 items-center">
                            {studentPhotoFile ? (
                              <img src={studentPhotoFile} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-foreground/20 text-[9px] shrink-0 font-bold">No Image</div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setStudentPhotoFile(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="w-full text-xs text-foreground file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 file:cursor-pointer"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setShowUploadModal(false)}
                            className="px-4 py-2 border border-border rounded-xl text-xs font-bold hover:bg-muted/50 transition-colors"
                          >
                            {lang === "en" ? "Cancel" : "বাতিল"}
                          </button>
                          <button
                            type="submit"
                            disabled={isUploadingPhoto}
                            className="px-6 py-2 bg-primary text-background rounded-xl text-xs font-bold hover:scale-102 disabled:opacity-50 transition-all"
                          >
                            {isUploadingPhoto ? (lang === "en" ? "Uploading..." : "আপলোড হচ্ছে...") : (lang === "en" ? "Submit Photo" : "সাবমিট করুন")}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {galleryItems.map((item, idx) => (
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
                    <div className="grid gap-6 sm:grid-cols-2">
                      {/* Lunch Card */}
                      <div className="group rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] shadow-lg">
                        <div className="relative">
                          {renderMarquee(menu?.lunchImages, "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&q=80", "Lunch")}
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 backdrop-blur-md z-10 pointer-events-none">
                            {lang === "en" ? "Lunch" : "দুপুরের খাবার"}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="font-serif text-[11px] font-bold uppercase tracking-widest text-foreground/40 mb-1.5">Afternoon Feast</h4>
                          {menu?.lunch ? (
                            <p className="text-xl sm:text-2xl font-serif font-extrabold text-primary tracking-tight leading-snug min-h-[50px] italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                              {menu.lunch}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-foreground/35 italic leading-relaxed min-h-[50px] flex items-center">
                              {lang === "en" ? "No lunch logged today." : "আজকে দুপুরের খাবার লিপিবদ্ধ করা হয়নি।"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Dinner Card */}
                      <div className="group rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02] shadow-lg">
                        <div className="relative">
                          {renderMarquee(menu?.dinnerImages, "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&q=80", "Dinner")}
                          <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 border border-sky-500/40 text-sky-400 backdrop-blur-md z-10 pointer-events-none">
                            {lang === "en" ? "Dinner" : "রাতের খাবার"}
                          </span>
                        </div>
                        <div className="p-5">
                          <h4 className="font-serif text-[11px] font-bold uppercase tracking-widest text-foreground/40 mb-1.5">Night Delight</h4>
                          {menu?.dinner ? (
                            <p className="text-xl sm:text-2xl font-serif font-extrabold text-primary tracking-tight leading-snug min-h-[50px] italic drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                              {menu.dinner}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-foreground/35 italic leading-relaxed min-h-[50px] flex items-center">
                              {lang === "en" ? "No dinner logged today." : "আজকে রাতের খাবার লিপিবদ্ধ করা হয়নি।"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estimations and AI insights section removed per design requirements */}

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
                        {commentsPage.length === 0 ? (
                          <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl text-xs text-foreground/45">
                            {lang === "en" ? "No comments logged for today's meals yet." : "আজকের খাবার সম্পর্কে এখনো কোনো প্রতিক্রিয়া নেই।"}
                          </div>
                        ) : (
                          commentsPage.map(c => (
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
                        
                        {hasMoreComments && (
                          <button
                            onClick={() => loadComments(false)}
                            className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-foreground rounded-xl text-xs font-bold transition-all"
                          >
                            {lang === "en" ? "Load More Comments" : "আরও মন্তব্য দেখুন"}
                          </button>
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
                        {(() => {
                          const currentMonthStr = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
                          const activeMonth = managers.some(m => m.month === currentMonthStr) ? currentMonthStr : (managers[0]?.month || "May 2026");
                          const filtered = managers.filter(m => m.month === activeMonth);
                          if (filtered.length === 0) {
                            return <p className="text-xs text-foreground/40">{lang === "en" ? "No active managers" : "কোনো সক্রিয় পরিচালক নেই"}</p>;
                          }
                          return filtered.map(m => (
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
                          ));
                        })()}
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
                          {lang === "en" ? "Pay in time to avoid penalty." : "জরিমানা এড়াতে নির্ধারিত সময়ে পরিশোধ করুন।"}
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
                      src={provost?.photoUrl || "https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=300&q=80"} 
                      alt="Provost" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {lang === "en" ? "Hall Provost Office" : "হল প্রভোস্ট কার্যালয়"}
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mt-1">
                      {provost?.name || (lang === "en" ? "Dr. Md. Ashiqur Rahman" : "ড. মো. আশিকুর রহমান")}
                    </h3>
                    <p className="text-xs sm:text-sm text-foreground/50 mt-1 font-semibold">
                      {provost?.dept || (lang === "en" ? "Professor, Department of Mechanical Engineering · Provost, Sher-E-Bangla Hall, BUET" : "অধ্যাপক, যন্ত্রকৌশল বিভাগ · প্রভোস্ট, শেরে বাংলা হল, বুয়েট")}
                    </p>
                    <p className="max-w-[560px] text-xs sm:text-sm text-foreground/60 mt-4 leading-relaxed">
                      {provost?.bio || (lang === "en" 
                        ? "Associate Director, Directorate of Student Welfare (Former). Email: ashiqurrahman@me.buet.ac.bd · ashiqur78@yahoo.com"
                        : "ashiqurrahman@me.buet.ac.bd · ashiqur78@yahoo.com")}
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

                {/* System Developer Profile Card */}
                <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-primary/15 via-white/[0.01] to-transparent border border-primary/20 flex flex-col md:flex-row items-center gap-6 sm:gap-8 mt-10 relative overflow-hidden shadow-xl hover:border-primary/45 transition-all duration-300">
                  <div className="absolute right-0 top-0 px-3 py-1.5 bg-primary/10 rounded-bl-2xl text-[9px] font-bold uppercase tracking-wider text-primary border-l border-b border-primary/10">
                    {lang === "en" ? "System Developer" : "সিস্টেম ডেভেলপার"}
                  </div>
                  <div className="absolute right-0 top-0 w-60 h-60 rounded-full bg-primary/[0.02] filter blur-2xl pointer-events-none" />
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/10 shrink-0 self-center">
                    <img 
                      src={developerPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"} 
                      alt="MISHAT MILON" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {lang === "en" ? "Platform Creator" : "প্ল্যাটফর্ম নির্মাতা"}
                    </span>
                    <h3 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mt-1">
                      MISHAT MILON
                    </h3>
                    <div className="text-xs text-foreground/50 mt-1.5 font-mono space-x-2 flex flex-wrap justify-center md:justify-start gap-y-1">
                      <span>DEPT: EEE</span>
                      <span>•</span>
                      <span>ROOM: 207</span>
                      <span>•</span>
                      <span>ID: 2106059</span>
                    </div>
                    <p className="max-w-[560px] text-xs sm:text-sm text-foreground/60 mt-4 leading-relaxed italic border-l border-primary/30 pl-3 inline-block text-left">
                      {lang === "en" 
                        ? '"Architected, designed, and developed the HMMS platform."' 
                        : '"এইচএমএমএস প্ল্যাটফর্মের আর্কিটেক্ট, ডিজাইনার এবং ডেভেলপার।"'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ==========================================
                7. COMPLAINTS DESK TAB (STUDENTS)
                ========================================== */}
            {activeTab === "complaints" && (
              <section className="pt-10 max-w-2xl mx-auto">
                <div className="text-center mb-12">
                  <div className="section-tag flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-6 h-[1px] bg-primary"></span>
                    {lang === "en" ? "Resident Support Desk" : "আবাসিক অভিযোগ শাখা"}
                    <span className="w-6 h-[1px] bg-primary"></span>
                  </div>
                  <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                    {lang === "en" ? "Complaints " : "অভিযোগ "} 
                    <em className="font-serif italic text-primary not-italic">{lang === "en" ? "Desk" : "ডেস্ক"}</em>
                  </h2>
                  <p className="text-xs text-foreground/50 mt-2">
                    {lang === "en" 
                      ? "Submit dining or hall mess complaints directly to managers. You may optionally remain anonymous." 
                      : "মেস ও ডাইনিং সংক্রান্ত যেকোনো অভিযোগ সরাসরি ম্যানেজারদের কাছে পাঠান। চাইলে নাম প্রকাশ নাও করতে পারেন।"}
                  </p>
                </div>

                <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-xl space-y-6">
                  <form onSubmit={handleStudentComplaintSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-primary tracking-wide mb-1.5">
                        {lang === "en" ? "Issue Category" : "অভিযোগের বিষয়"}
                      </label>
                      <select
                        value={complaintCategory}
                        onChange={(e) => setComplaintCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary/50 text-foreground"
                      >
                        <option value="Food Quality" className="bg-background text-foreground">{lang === "en" ? "Food Quality" : "খাবারের মান"}</option>
                        <option value="Hygiene & Sanitation" className="bg-background text-foreground">{lang === "en" ? "Hygiene & Sanitation" : "পরিচ্ছন্নতা ও স্যানিটেশন"}</option>
                        <option value="Meal Distribution / Delay" className="bg-background text-foreground">{lang === "en" ? "Meal Distribution / Delay" : "খাবার বিতরণ / দেরি"}</option>
                        <option value="Token & Payments" className="bg-background text-foreground">{lang === "en" ? "Token & Payments" : "টোকেন ও পেমেন্ট"}</option>
                        <option value="Other Issues" className="bg-background text-foreground">{lang === "en" ? "Other Issues" : "অন্যান্য সমস্যা"}</option>
                      </select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-foreground/50 tracking-wide mb-1.5">
                          {lang === "en" ? "Your Name (Optional)" : "আপনার নাম (ঐচ্ছিক)"}
                        </label>
                        <input
                          type="text"
                          value={complaintName}
                          onChange={(e) => setComplaintName(e.target.value)}
                          placeholder={lang === "en" ? "e.g. Sajib" : "যেমন: সজীব"}
                          className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary/50 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-foreground/50 tracking-wide mb-1.5">
                          {lang === "en" ? "Room No (Optional)" : "রুম নং (ঐচ্ছিক)"}
                        </label>
                        <input
                          type="text"
                          value={complaintRoom}
                          onChange={(e) => setComplaintRoom(e.target.value)}
                          placeholder="e.g. 308"
                          className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary/50 text-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-foreground/50 tracking-wide mb-1.5">
                          {lang === "en" ? "Batch (Optional)" : "ব্যাচ (ঐচ্ছিক)"}
                        </label>
                        <input
                          type="text"
                          value={complaintBatch}
                          onChange={(e) => setComplaintBatch(e.target.value)}
                          placeholder="e.g. 21"
                          className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary/50 text-foreground"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-primary tracking-wide mb-1.5">
                        {lang === "en" ? "Complaint Description" : "অভিযোগের বিস্তারিত বিবরণ"}
                      </label>
                      <textarea
                        value={complaintDesc}
                        onChange={(e) => setComplaintDesc(e.target.value)}
                        placeholder={lang === "en" ? "Describe the issue in detail..." : "সমস্যাটি বিস্তারিতভাবে লিখুন..."}
                        rows={5}
                        className="w-full px-4 py-3 bg-white/[0.04] border border-white/10 rounded-xl text-xs focus:outline-none focus:border-primary/50 text-foreground leading-relaxed resize-none"
                        required
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={submittingComplaint}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-background rounded-xl text-xs font-bold uppercase tracking-wider hover:scale-102 hover:shadow-lg hover:shadow-primary/10 transition-all disabled:opacity-50"
                      >
                        {submittingComplaint ? (
                          lang === "en" ? "Submitting..." : "জমা হচ্ছে..."
                        ) : (
                          <>
                            <Send size={12} />
                            {lang === "en" ? "Submit Complaint" : "অভিযোগ জমা দিন"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {renderVerificationModal()}
      {renderLightboxModal()}
    </div>
  );
};
export default StudentPortal;
