import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  knowledgeLabels,
  privacyReadinessItems,
  shortlistStatuses,
  timelineKinds,
  type DraftPost,
  type DraftShortlistItem,
  type DraftTimelineEntry,
  type DraftVehicle,
  type FollowState,
  type GarageVehicle,
  type KnowledgeLabel,
  type OwnerPost,
  type Profile,
  type ReportRecord,
  type ShortlistItem,
  type SubscriptionSettings,
  type TimelineEntry,
  type TimelineEntryKind,
} from "./domain";
import {
  assessPostQuality,
  buildCityCircles,
  buildConnectionStatusCopy,
  buildGarageCostLedger,
  buildGarageExportMarkdown,
  buildGarageReminders,
  buildInspectionChecklists,
  buildModelSharePayload,
  buildModerationSummary,
  buildNotificationPreview,
  buildPostSharePayload,
  buildPrivacyReadinessSummary,
  buildShortlistComparisons,
  buildShortlistDecisionLanes,
  filterPostsByMode,
  formatMoney,
  groupByModel,
  modelKeyFor,
} from "./insights";
import {
  createPost,
  createReport,
  createShortlistItem,
  createTimelineEntry,
  createVehicle,
  loadFollows,
  loadGarage,
  loadProfile,
  loadPosts,
  loadReports,
  loadSaved,
  loadShortlist,
  loadSubscriptionSettings,
  loadTimeline,
  saveFollows,
  saveGarage,
  savePosts,
  saveProfile,
  saveReports,
  saveSaved,
  saveShortlist,
  saveSubscriptionSettings,
  saveTimeline,
} from "./storage";

type FeedMode = "latest" | "helpful" | "saved" | "following";
type WorkspaceScreen = "home" | "shortlist" | "garage" | "community" | "account";
type AccountView = "profile" | "saved" | "following" | "notifications" | "settings";

const brands = ["Tata", "Honda", "Kia", "Mahindra", "Maruti Suzuki", "Hyundai", "Toyota", "Skoda", "Volkswagen"];

const initialDraft: DraftPost = {
  title: "",
  author: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  label: "Owner note",
  topic: "Ownership review",
  body: "",
};

const initialVehicleDraft: DraftVehicle = {
  nickname: "",
  brand: "Tata",
  model: "",
  variant: "",
  city: "",
  odometerKm: 0,
  purchaseMonth: "",
};

const initialTimelineDraft: DraftTimelineEntry = {
  vehicleId: "",
  kind: "Service",
  title: "",
  amount: 0,
  odometerKm: 0,
  happenedOn: new Date().toISOString().slice(0, 10),
  note: "",
};

const initialShortlistDraft: DraftShortlistItem = {
  brand: "Tata",
  budget: 1200000,
  model: "",
  notes: "",
  status: "Researching",
};

const garageRoles: Profile["garageRole"][] = ["Owner", "Buyer", "Enthusiast", "Mechanic"];

const getInitialOnlineStatus = (): boolean => {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  } catch {
    return true;
  }
};

export function App() {
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [reports, setReports] = useState<ReportRecord[]>(() => loadReports());
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => loadShortlist());
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved());
  const [follows, setFollows] = useState<FollowState>(() => loadFollows());
  const [subscriptionSettings, setSubscriptionSettings] = useState<SubscriptionSettings>(() => loadSubscriptionSettings());
  const [garage, setGarage] = useState<GarageVehicle[]>(() => loadGarage());
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => loadTimeline());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FeedMode>("latest");
  const [selectedLabel, setSelectedLabel] = useState<KnowledgeLabel | "All">("All");
  const [selectedPost, setSelectedPost] = useState<OwnerPost | null>(posts[0] ?? null);
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPost>(initialDraft);
  const [vehicleDraft, setVehicleDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [timelineDraft, setTimelineDraft] = useState<DraftTimelineEntry>(() => ({
    ...initialTimelineDraft,
    vehicleId: loadGarage()[0]?.id ?? "",
  }));
  const [shortlistDraft, setShortlistDraft] = useState<DraftShortlistItem>(initialShortlistDraft);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportDraft, setReportDraft] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [accountView, setAccountView] = useState<AccountView>("profile");
  const [vehicleMenuOpen, setVehicleMenuOpen] = useState(false);
  const [shortlistFormOpen, setShortlistFormOpen] = useState(false);
  const [garageForm, setGarageForm] = useState<"vehicle" | "record" | null>(null);
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [activeScreen, setActiveScreen] = useState<WorkspaceScreen>("home");
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const communitySearchRef = useRef<HTMLInputElement>(null);
  const postTitleRef = useRef<HTMLInputElement>(null);
  const shortlistModelRef = useRef<HTMLInputElement>(null);
  const timelineTitleRef = useRef<HTMLInputElement>(null);
  const vehicleNicknameRef = useRef<HTMLInputElement>(null);
  const postDetailHeadingRef = useRef<HTMLHeadingElement>(null);
  const shortlistHeadingRef = useRef<HTMLHeadingElement>(null);
  const garageHeadingRef = useRef<HTMLHeadingElement>(null);
  const profileNameRef = useRef<HTMLInputElement>(null);
  const settingsHeadingRef = useRef<HTMLHeadingElement>(null);
  const notificationsFirstRef = useRef<HTMLInputElement>(null);
  const accountHeaderRef = useRef<HTMLHeadingElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const vehicleMenuRef = useRef<HTMLDivElement>(null);
  const vehicleTriggerRef = useRef<HTMLButtonElement>(null);
  const accountReturnScreenRef = useRef<WorkspaceScreen>("home");

  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  const filteredPosts = useMemo(
    () =>
      filterPostsByMode(posts, {
        followedModelSet,
        followedTopicSet,
        mode,
        query,
        saved,
        selectedLabel,
      }),
    [followedModelSet, followedTopicSet, mode, posts, query, saved, selectedLabel],
  );

  const connectionStatus = useMemo(() => buildConnectionStatusCopy(isOnline), [isOnline]);

  const notificationPreview = useMemo(
    () => buildNotificationPreview({ follows, posts, preference: subscriptionSettings }),
    [follows, posts, subscriptionSettings],
  );

  const garageCostLedger = useMemo(() => buildGarageCostLedger(garage, timeline), [garage, timeline]);
  const garageReminders = useMemo(() => buildGarageReminders(garage, timeline), [garage, timeline]);
  const cityCircles = useMemo(() => buildCityCircles(posts, garage), [garage, posts]);
  const moderationSummary = useMemo(() => buildModerationSummary(reports), [reports]);
  const privacySummary = useMemo(() => buildPrivacyReadinessSummary(privacyReadinessItems), []);
  const shortlistComparisons = useMemo(() => buildShortlistComparisons(shortlist, posts), [posts, shortlist]);
  const shortlistDecisionLanes = useMemo(() => buildShortlistDecisionLanes(shortlist, posts), [posts, shortlist]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, posts), [posts, shortlist]);
  const inspectionChecklistByItemId = useMemo(
    () => new Map(inspectionChecklists.map((checklist) => [checklist.item.id, checklist])),
    [inspectionChecklists],
  );
  const draftQuality = useMemo(() => assessPostQuality(draft), [draft]);
  const selectedPostQuality = useMemo(() => (selectedPost ? assessPostQuality(selectedPost) : null), [selectedPost]);

  const stats = useMemo(
    () => ({
      posts: posts.length,
      models: notebooks.length,
      fixes: posts.filter((post) => post.label === "Fix").length,
      confirmations: posts.reduce((total, post) => total + post.fixesConfirmed, 0),
      follows: follows.models.length + follows.topics.length,
      garage: garage.length,
      reports: moderationSummary.openReports,
      shortlist: shortlist.length,
    }),
    [follows.models.length, follows.topics.length, garage.length, moderationSummary.openReports, notebooks.length, posts, shortlist.length],
  );

  useEffect(() => {
    const updateOnline = () => setIsOnline(true);
    const updateOffline = () => setIsOnline(false);

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOffline);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOffline);
    };
  }, []);

  useEffect(() => {
    if (!vehicleMenuOpen) return;

    const closeAndRestoreFocus = () => {
      setVehicleMenuOpen(false);
      window.requestAnimationFrame(() => vehicleTriggerRef.current?.focus());
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAndRestoreFocus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (vehicleMenuRef.current?.contains(target) || vehicleTriggerRef.current?.contains(target)) return;
      closeAndRestoreFocus();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [vehicleMenuOpen]);

  const persistPosts = (nextPosts: OwnerPost[]) => {
    setPosts(nextPosts);
    savePosts(nextPosts);
  };

  const persistFollows = (nextFollows: FollowState) => {
    setFollows(nextFollows);
    saveFollows(nextFollows);
  };

  const persistSubscriptionSettings = (nextSettings: SubscriptionSettings) => {
    setSubscriptionSettings(nextSettings);
    saveSubscriptionSettings(nextSettings);
  };

  const persistProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  const persistReports = (nextReports: ReportRecord[]) => {
    setReports(nextReports);
    saveReports(nextReports);
  };

  const persistShortlist = (nextShortlist: ShortlistItem[]) => {
    setShortlist(nextShortlist);
    saveShortlist(nextShortlist);
  };

  const persistGarage = (nextGarage: GarageVehicle[]) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const persistTimeline = (nextTimeline: TimelineEntry[]) => {
    setTimeline(nextTimeline);
    saveTimeline(nextTimeline);
  };

  const toggleSaved = (postId: string) => {
    const next = new Set(saved);
    const wasSaved = next.has(postId);
    if (wasSaved) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
    setActionMessage(wasSaved ? "Removed from saved notes." : "Note saved.");
  };

  const toggleFollowModel = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const nextModels = follows.models.includes(key) ? follows.models.filter((item) => item !== key) : [...follows.models, key];
    persistFollows({ ...follows, models: nextModels });
  };

  const toggleFollowTopic = (topic: KnowledgeLabel) => {
    const nextTopics = follows.topics.includes(topic)
      ? follows.topics.filter((item) => item !== topic)
      : [...follows.topics, topic];
    persistFollows({ ...follows, topics: nextTopics });
  };

  const markHelpful = (postId: string) => {
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: post.helpful + 1 } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const confirmFix = (postId: string) => {
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: post.fixesConfirmed + 1, helpful: post.helpful + 1 } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const addComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !commentDraft.trim()) return;
    const author = profile.displayName.trim() || "Anonymous garage member";
    const next = posts.map((post) =>
      post.id === selectedPost.id ? { ...post, comments: [`${author}: ${commentDraft.trim()}`, ...post.comments] } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === selectedPost.id) ?? null);
    setCommentDraft("");
    setActionMessage("Comment posted.");
  };

  const reportSelectedPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !reportDraft.trim()) return;
    const report = createReport({
      postId: selectedPost.id,
      postTitle: selectedPost.title,
      reason: reportDraft.trim(),
      reporterName: profile.displayName.trim() || "Anonymous reporter",
    });
    persistReports([report, ...reports]);
    setReportDraft("");
    setActionMessage("Report sent to moderators.");
  };

  const setReportStatus = (reportId: string, status: ReportRecord["status"]) => {
    persistReports(reports.map((report) => (report.id === reportId ? { ...report, status } : report)));
  };

  const removeReportedPost = (report: ReportRecord) => {
    const nextPosts = posts.filter((post) => post.id !== report.postId);
    persistPosts(nextPosts);
    persistReports(reports.map((item) => (item.id === report.id ? { ...item, status: "Removed" } : item)));
    if (selectedPost?.id === report.postId) setSelectedPost(nextPosts[0] ?? null);
  };

  const shareText = async (payload: { text: string; title: string }) => {
    try {
      if (navigator.share) {
        await navigator.share(payload);
        setActionMessage("Shared.");
        return;
      }

      await navigator.clipboard.writeText(`${payload.title}\n\n${payload.text}`);
      setActionMessage("Copied to clipboard.");
    } catch {
      setActionMessage("Sharing was cancelled or blocked by the browser.");
    }
  };

  const shareSelectedPost = () => {
    if (!selectedPost) return;
    void shareText(buildPostSharePayload(selectedPost));
  };

  const shareModelNotebook = (brand: string, model: string) => {
    const notebook = notebooks.find((item) => item.key === modelKeyFor(brand, model));
    if (!notebook) return;
    void shareText(buildModelSharePayload(notebook));
  };

  const exportGarage = () => {
    void shareText({
      title: "Autoflex garage export",
      text: buildGarageExportMarkdown(garage, timeline),
    });
  };

  const addShortlistItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shortlistDraft.model.trim()) return;
    const item = createShortlistItem(shortlistDraft);
    persistShortlist([item, ...shortlist]);
    setShortlistDraft(initialShortlistDraft);
    setShortlistFormOpen(false);
    setActionMessage(`${item.brand} ${item.model} added. Review its inspection checks next.`);
    window.requestAnimationFrame(() => {
      document.getElementById("shortlist")?.scrollIntoView({ block: "start" });
      shortlistHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const addSelectedToShortlist = () => {
    if (!selectedPost) return;
    const alreadyShortlisted = shortlist.some(
      (item) => modelKeyFor(item.brand, item.model) === modelKeyFor(selectedPost.brand, selectedPost.model),
    );
    if (alreadyShortlisted) {
      setActionMessage("That model is already in your shortlist.");
      return;
    }
    persistShortlist([
      createShortlistItem({
        brand: selectedPost.brand,
        budget: 0,
        model: selectedPost.model,
        notes: `Added from: ${selectedPost.title}`,
        status: "Researching",
      }),
      ...shortlist,
    ]);
    setActionMessage(`${selectedPost.brand} ${selectedPost.model} added to shortlist.`);
  };

  const updateShortlistItem = (itemId: string, patch: Partial<ShortlistItem>) => {
    persistShortlist(shortlist.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const removeShortlistItem = (itemId: string) => {
    persistShortlist(shortlist.filter((item) => item.id !== itemId));
  };

  const publishPost = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const post = createPost({
      ...draft,
      author: draft.author.trim() || "Anonymous owner",
      odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
    });
    const next = [post, ...posts];
    persistPosts(next);
    setSelectedPost(post);
    setPostDetailOpen(true);
    setPostComposerOpen(false);
    setDraft(initialDraft);
    setActionMessage("Owner note published.");
    window.requestAnimationFrame(() => postDetailHeadingRef.current?.focus());
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage]);
    setTimelineDraft((current) => ({ ...current, vehicleId: vehicle.id }));
    setVehicleDraft(initialVehicleDraft);
    setGarageForm(null);
    setActionMessage(`${vehicle.nickname || `${vehicle.brand} ${vehicle.model}`} added. Add its first service or cost record next.`);
    window.requestAnimationFrame(() => {
      document.getElementById("garage")?.scrollIntoView({ block: "start" });
      garageHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const addTimelineNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timelineDraft.vehicleId) return;
    const entry = createTimelineEntry({
      ...timelineDraft,
      amount: Number.isFinite(timelineDraft.amount) ? timelineDraft.amount : 0,
      odometerKm: Number.isFinite(timelineDraft.odometerKm) ? timelineDraft.odometerKm : 0,
    });
    persistTimeline([entry, ...timeline]);
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
    setGarageForm(null);
    setActionMessage("Service or cost record saved.");
  };

  const openWorkspace = (screen: WorkspaceScreen, nav: string = screen, nextMode?: FeedMode) => {
    if (nextMode) setMode(nextMode);
    setActiveScreen(screen);
    setActiveNav(nav);
    window.scrollTo(0, 0);
  };

  const openProfile = (trigger: HTMLButtonElement) => {
    profileTriggerRef.current = trigger;
    accountReturnScreenRef.current = activeScreen;
    openAccountView("profile");
  };

  const openAccountView = (view: AccountView) => {
    setAccountView(view);
    setActiveScreen("account");
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => {
      if (view === "profile") profileNameRef.current?.focus();
      if (view === "saved" || view === "following") accountHeaderRef.current?.focus();
      if (view === "notifications") notificationsFirstRef.current?.focus();
      if (view === "settings") settingsHeadingRef.current?.focus();
    });
  };

  const returnFromAccount = () => {
    if (accountView !== "profile") {
      openAccountView("profile");
      return;
    }
    setActiveScreen(accountReturnScreenRef.current);
    window.scrollTo(0, 0);
    window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
  };

  const selectVehicle = (vehicleId: string) => {
    const vehicle = garage.find((item) => item.id === vehicleId);
    setTimelineDraft((current) => ({ ...current, vehicleId }));
    setVehicleMenuOpen(false);
    if (vehicle) setActionMessage(`${vehicle.nickname || vehicle.model} selected.`);
    window.requestAnimationFrame(() => vehicleTriggerRef.current?.focus());
  };

  const openVehicleMenu = () => {
    setVehicleMenuOpen(true);
    window.requestAnimationFrame(() => {
      const selectedOption = vehicleMenuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      selectedOption?.focus();
    });
  };

  const handleVehicleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(vehicleMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!options.length) return;
    const currentIndex = Math.max(0, options.indexOf(document.activeElement as HTMLButtonElement));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      options[(currentIndex + 1) % options.length]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      options[(currentIndex - 1 + options.length) % options.length]?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      options[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      options.at(-1)?.focus();
    }
  };

  const openPostDetail = (post: OwnerPost) => {
    setSelectedPost(post);
    setPostDetailOpen(true);
    window.requestAnimationFrame(() => {
      document.querySelector(".detail-card")?.scrollIntoView({ block: "start" });
      postDetailHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const openPostComposer = () => {
    openWorkspace("community", "community");
    setPostComposerOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("write")?.scrollIntoView({ block: "start" });
      postTitleRef.current?.focus({ preventScroll: true });
    });
  };

  const openShortlistComposer = () => {
    openWorkspace("shortlist");
    setShortlistFormOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("shortlist-form")?.scrollIntoView({ block: "start" });
      shortlistModelRef.current?.focus({ preventScroll: true });
    });
  };

  const openVehicleComposer = () => {
    openWorkspace("garage");
    setGarageForm("vehicle");
    window.requestAnimationFrame(() => {
      document.getElementById("vehicle-form")?.scrollIntoView({ block: "start" });
      vehicleNicknameRef.current?.focus({ preventScroll: true });
    });
  };

  const openGarageRecordComposer = () => {
    if (!currentVehicle) {
      openVehicleComposer();
      return;
    }
    openWorkspace("garage");
    setGarageForm("record");
    window.requestAnimationFrame(() => {
      document.getElementById("timeline-form")?.scrollIntoView({ block: "start" });
      timelineTitleRef.current?.focus({ preventScroll: true });
    });
  };

  const returnToCommunityFeed = () => {
    setPostComposerOpen(false);
    setPostDetailOpen(false);
    document.getElementById("feed")?.scrollIntoView({ block: "start" });
    communitySearchRef.current?.focus({ preventScroll: true });
  };

  const currentVehicle = garage.find((vehicle) => vehicle.id === timelineDraft.vehicleId) ?? garage[0] ?? null;
  const currentReminder = garageReminders.find((reminder) => reminder.vehicleId === currentVehicle?.id) ?? garageReminders[0] ?? null;
  const currentLedger = garageCostLedger.find((ledger) => ledger.vehicle.id === currentVehicle?.id) ?? null;
  const isFirstRun = garage.length === 0 && shortlist.length === 0;
  const workspaceCopy: Record<WorkspaceScreen, { eyebrow: string; title: string; detail: string }> = {
    home: { eyebrow: "Today", title: "Today", detail: "Your car's next task." },
    shortlist: { eyebrow: "Shortlist", title: "Compare cars", detail: `${shortlist.length} car${shortlist.length === 1 ? "" : "s"} saved with owner notes and inspection steps.` },
    garage: { eyebrow: "Garage", title: "My car", detail: currentVehicle ? `${currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`}: service, costs, and records.` : "Add your car to track service and costs." },
    community: { eyebrow: "Community", title: "Owner notes", detail: `${filteredPosts.length} note${filteredPosts.length === 1 ? "" : "s"} match the current search.` },
    account:
      accountView === "profile"
        ? { eyebrow: "Account", title: "Profile", detail: "Your local name, city, and owner role." }
        : accountView === "saved"
          ? { eyebrow: "Profile", title: "Saved notes", detail: "Owner notes you kept for later." }
          : accountView === "following"
            ? { eyebrow: "Profile", title: "Following", detail: "Cars and topics you follow." }
        : accountView === "notifications"
          ? { eyebrow: "Account", title: "Notifications", detail: "Choose which updates appear on this device." }
          : { eyebrow: "Account", title: "Settings & privacy", detail: "Review what Autoflex stores on this device." },
  };
  const accountBackLabel =
    accountView !== "profile"
      ? "Back to Profile"
      : `Back to ${accountReturnScreenRef.current === "home" ? "Today" : accountReturnScreenRef.current === "shortlist" ? "Shortlist" : accountReturnScreenRef.current === "garage" ? "Garage" : "Community"}`;
  return (
    <main className="app-shell" data-screen={activeScreen}>
      <aside className="desktop-rail" aria-label="Autoflex navigation">
        <a className="rail-brand" href="#top" aria-label="Autoflex Today" onClick={() => openWorkspace("home", "home")}>
          Auto<span>flex</span>
        </a>
        <p className="rail-kicker">Cars, service, and owner notes</p>
        <nav className="rail-nav" aria-label="Primary destinations">
          <a className={activeNav === "home" ? "is-active" : ""} href="#top" aria-current={activeNav === "home" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
            <span className="shell-icon" aria-hidden="true">⌂</span>
            <span>Today</span>
          </a>
          <a className={activeNav === "shortlist" ? "is-active" : ""} href="#shortlist" aria-current={activeNav === "shortlist" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("shortlist"); }}>
            <span className="shell-icon" aria-hidden="true">▤</span>
            <span>Shortlist</span>
            <strong>{shortlist.length}</strong>
          </a>
          <a className={activeNav === "garage" ? "is-active" : ""} href="#garage" aria-current={activeNav === "garage" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("garage"); }}>
            <span className="shell-icon" aria-hidden="true">▣</span>
            <span>Garage</span>
            <strong>{garage.length}</strong>
          </a>
          <a className={activeNav === "community" ? "is-active" : ""} href="#feed" aria-current={activeNav === "community" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("community", "community", "latest"); }}>
            <span className="shell-icon" aria-hidden="true">◉</span>
            <span>Community</span>
          </a>
        </nav>
        <div className="rail-status">
          <span className={`status-dot ${connectionStatus.tone}`} aria-hidden="true" />
          <div>
            <strong>{connectionStatus.label}</strong>
            <small>Local records stay on this device.</small>
          </div>
        </div>
      </aside>

      <section className="hero screen-home">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Autoflex Today" onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
            Auto<span>flex</span>
          </a>
          <div className="nav-context" aria-label="Today summary">
            <span>Today</span>
            <strong>{garage.length ? `${garage.length} garage record${garage.length === 1 ? "" : "s"}` : "Garage not started"}</strong>
          </div>
          <button aria-label="Open Profile" className="account-button" type="button" onClick={(event) => openProfile(event.currentTarget)}>
            <span aria-hidden="true">{profile.displayName.trim().slice(0, 1).toUpperCase() || "A"}</span>
            <strong>Profile</strong>
          </button>
        </nav>

        <div className="home-workbench" id="top">
          <div className="home-toolbar">
            <div>
              <p className="app-kicker">Today</p>
              <h1>What needs attention today</h1>
              <p className="home-status">{currentVehicle ? `${currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`} is selected.` : "Add a car you own or one you are comparing."}</p>
            </div>
            <div className="home-toolbar-actions">
              {isFirstRun ? (
                <div className="first-run-actions" aria-label="Choose how to start">
                  <button className="primary-action first-run-action" type="button" onClick={openVehicleComposer}>
                    <span aria-hidden="true">+</span>
                    <span><small>I own a car</small>Add vehicle</span>
                  </button>
                  <button className="save-button first-run-action" type="button" onClick={openShortlistComposer}>
                    <span aria-hidden="true">▤</span>
                    <span><small>I'm choosing a car</small>Add candidate</span>
                  </button>
                </div>
              ) : garage.length === 1 && currentVehicle ? (
                <div className="vehicle-summary" aria-label="Current vehicle">
                  <span>My car</span>
                  <strong>{currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`}</strong>
                  <small>{currentVehicle.brand} {currentVehicle.model}{currentVehicle.variant ? ` · ${currentVehicle.variant}` : ""}</small>
                </div>
              ) : currentVehicle ? (
                <div className="vehicle-switcher">
                  <span className="vehicle-switcher-label">Current vehicle</span>
                  <button
                    aria-controls="vehicle-menu"
                    aria-expanded={vehicleMenuOpen}
                    aria-haspopup="listbox"
                    className="vehicle-switcher-trigger"
                    ref={vehicleTriggerRef}
                    type="button"
                    onClick={() => vehicleMenuOpen ? setVehicleMenuOpen(false) : openVehicleMenu()}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        openVehicleMenu();
                      }
                    }}
                  >
                    <span><strong>{currentVehicle.nickname || currentVehicle.model}</strong><small>{currentVehicle.brand} {currentVehicle.model}</small></span>
                    <span aria-hidden="true">⌄</span>
                  </button>
                  <div
                    aria-label="Choose a vehicle"
                    className={`compact-popover vehicle-menu ${vehicleMenuOpen ? "is-open" : ""}`}
                    id="vehicle-menu"
                    onKeyDown={handleVehicleMenuKeyDown}
                    ref={vehicleMenuRef}
                    role="listbox"
                  >
                    {garage.map((vehicle) => (
                      <button
                        aria-selected={vehicle.id === currentVehicle.id}
                        key={vehicle.id}
                        role="option"
                        type="button"
                        onClick={() => selectVehicle(vehicle.id)}
                      >
                        <span aria-hidden="true">{vehicle.id === currentVehicle.id ? "✓" : ""}</span>
                        <span><strong>{vehicle.nickname || vehicle.model}</strong><small>{vehicle.brand} {vehicle.model}{vehicle.variant ? ` · ${vehicle.variant}` : ""}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {!isFirstRun ? (
                <button className="primary-action workspace-task-action" type="button" onClick={openVehicleComposer}>
                  <span aria-hidden="true">+</span>
                  Add vehicle
                </button>
              ) : null}
            </div>
          </div>
          {isFirstRun ? (
            <div className="first-run-note">Add one car to see its next maintenance task or inspection check.</div>
          ) : (
          <div className="home-work-grid">
            <article className="next-action-card">
              <span className="readout-label">Service due</span>
              <h2>{currentReminder?.title ?? "Add your vehicle"}</h2>
              <p>{currentReminder?.detail ?? "Add one vehicle to track service, repairs, and costs."}</p>
              <button className="save-button" type="button" onClick={() => openWorkspace("garage")}>
                {currentVehicle ? "View car records" : "Add your vehicle"}
              </button>
            </article>
            <aside className="home-readout" aria-label="Current car summary">
              <div><span className="readout-label">Odometer</span><strong>{currentVehicle ? `${currentVehicle.odometerKm.toLocaleString("en-IN")} km` : "--"}</strong></div>
              <div><span className="readout-label">Logged cost</span><strong>{currentLedger ? formatMoney(currentLedger.totalSpend) : "--"}</strong></div>
              <div><span className="readout-label">Items to check</span><strong>{shortlistDecisionLanes.filter((lane) => lane.priority === "High").length + garageReminders.filter((reminder) => reminder.urgency === "Soon").length}</strong></div>
            </aside>
          </div>
          )}
        </div>
      </section>

      {actionMessage ? (
        <div className="action-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <section className="workspace-header" aria-label={`${workspaceCopy[activeScreen].title} screen`}>
        <div>
          {activeScreen === "account" ? <button className="detail-back" type="button" onClick={returnFromAccount}>{accountBackLabel}</button> : null}
          <p className="app-kicker">{workspaceCopy[activeScreen].eyebrow}</p>
          <h2 ref={activeScreen === "account" ? accountHeaderRef : undefined} tabIndex={activeScreen === "account" ? -1 : undefined}>{workspaceCopy[activeScreen].title}</h2>
          <p>{workspaceCopy[activeScreen].detail}</p>
        </div>
        <div className="workspace-header-actions">
          {activeScreen === "shortlist" && shortlist.length && !shortlistFormOpen ? <button className="primary-action workspace-task-action" type="button" onClick={openShortlistComposer}><span aria-hidden="true">+</span>Add candidate</button> : null}
          {activeScreen === "garage" && currentVehicle && garageForm === null ? <button className="primary-action workspace-task-action" type="button" onClick={openGarageRecordComposer}><span aria-hidden="true">+</span>Add service record</button> : null}
          {activeScreen === "community" && !postComposerOpen && !postDetailOpen ? <button className="primary-action workspace-task-action" type="button" onClick={openPostComposer}><span aria-hidden="true">✎</span>Write a note</button> : null}
          {activeScreen === "account" ? (
            <span className="workspace-account-button" aria-label="Profile">
              {profile.displayName.trim().slice(0, 1).toUpperCase() || "A"}
            </span>
          ) : (
            <button className="workspace-account-button" type="button" aria-label="Open Profile" onClick={(event) => openProfile(event.currentTarget)}>
              {profile.displayName.trim().slice(0, 1).toUpperCase() || "A"}
            </button>
          )}
        </div>
      </section>

      <section className="panel recent-activity-panel screen-home" aria-label="Recent useful activity">
        <div className="section-head">
          <div>
            <p className="eyebrow">New in Community</p>
            <h2>Recent owner notes</h2>
          </div>
          <button className="save-button" type="button" onClick={() => openWorkspace("community", "community", "latest")}>
            Search notes
          </button>
        </div>
        <div className="recent-activity-list">
          {posts.slice(0, 3).map((post) => (
            <a
              className="recent-activity-item"
              href="#feed"
              key={post.id}
              onClick={(event) => {
                event.preventDefault();
                openWorkspace("community", "community", "latest");
                openPostDetail(post);
              }}
            >
              <span>{post.label}</span>
              <strong>{post.title}</strong>
              <small>
                {post.brand} {post.model} · {post.city || "Community note"}
              </small>
            </a>
          ))}
        </div>
      </section>

      {accountView === "profile" ? (
      <section className="panel split-panel profile-panel screen-more" id="profile">
        <div className="profile-intro">
          <h2>Your name on owner notes</h2>
          <p>This profile stays on this device and is used when you write, comment, or report a note.</p>
        </div>
        <form className="composer" onSubmit={(event) => { event.preventDefault(); setActionMessage("Profile saved on this device."); }}>
          <input
            ref={profileNameRef}
            value={profile.displayName}
            onChange={(event) => persistProfile({ ...profile, displayName: event.target.value })}
            placeholder="Display name"
          />
          <div className="form-row">
            <input
              value={profile.city}
              onChange={(event) => persistProfile({ ...profile, city: event.target.value })}
              placeholder="City"
            />
            <select
              value={profile.garageRole}
              onChange={(event) => persistProfile({ ...profile, garageRole: event.target.value as Profile["garageRole"] })}
            >
              {garageRoles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
          <p className="form-note">
            Posting as {profile.displayName.trim() || "Anonymous garage member"}
            {profile.city.trim() ? ` from ${profile.city}` : ""}.
          </p>
          <button className="primary-action workspace-task-action" type="submit"><span aria-hidden="true">✓</span>Save profile</button>
        </form>
        <nav className="profile-utility-list" aria-label="Profile sections">
          <button type="button" onClick={() => openAccountView("saved")}><span aria-hidden="true">☆</span><span><strong>Saved notes</strong><small>{saved.size} note{saved.size === 1 ? "" : "s"}</small></span><span aria-hidden="true">›</span></button>
          <button type="button" onClick={() => openAccountView("following")}><span aria-hidden="true">◴</span><span><strong>Following</strong><small>{follows.models.length + follows.topics.length} cars and topics</small></span><span aria-hidden="true">›</span></button>
          <button type="button" onClick={() => openAccountView("notifications")}><span aria-hidden="true">!</span><span><strong>Notifications</strong><small>Weekly updates and quiet hours</small></span><span aria-hidden="true">›</span></button>
          <button type="button" onClick={() => openAccountView("settings")}><span aria-hidden="true">⚙</span><span><strong>Settings & privacy</strong><small>Local data and privacy details</small></span><span aria-hidden="true">›</span></button>
        </nav>
      </section>
      ) : null}

      {accountView === "saved" ? (
      <section className="panel profile-subscreen screen-more" aria-label="Saved notes">
        <div className="profile-subscreen-list">
          {posts.filter((post) => saved.has(post.id)).map((post) => (
            <button key={post.id} type="button" onClick={() => { openWorkspace("community", "community", "saved"); openPostDetail(post); }}>
              <span className="pill">{post.label}</span>
              <span><strong>{post.title}</strong><small>{post.brand} {post.model} · {post.city}</small></span>
            </button>
          ))}
          {!saved.size ? <div className="empty-state">No saved notes yet. Save an owner note to find it here.</div> : null}
        </div>
      </section>
      ) : null}

      {accountView === "following" ? (
      <section className="panel profile-subscreen screen-more" aria-label="Following">
        <div className="profile-subscreen-list">
          {notebooks.filter((notebook) => followedModelSet.has(notebook.key)).map((notebook) => (
            <button key={notebook.key} type="button" onClick={() => { setQuery(`${notebook.brand} ${notebook.model}`); openWorkspace("community", "community", "following"); }}>
              <span aria-hidden="true">▤</span>
              <span><strong>{notebook.brand} {notebook.model}</strong><small>{notebook.posts.length} owner notes</small></span>
            </button>
          ))}
          {follows.topics.map((topic) => <div className="profile-follow-row" key={topic}><span aria-hidden="true">#</span><strong>{topic}</strong></div>)}
          {!follows.models.length && !follows.topics.length ? <div className="empty-state">You are not following a car or topic yet.</div> : null}
        </div>
      </section>
      ) : null}

      {accountView === "settings" ? (
      <section className="panel privacy-panel screen-more" id="privacy">
        <div className="section-head">
          <div>
            <p className="eyebrow">Settings & privacy</p>
            <h2 ref={settingsHeadingRef} tabIndex={-1}>What Autoflex stores on this device</h2>
          </div>
          <div className="privacy-stats" aria-label="Privacy readiness summary">
            <span>{privacySummary["Stored for MVP"]} stored</span>
            <span>{privacySummary["Not collected"]} not collected</span>
            <span>{privacySummary["Deletion baseline"]} deletion</span>
          </div>
        </div>
        <div className="privacy-grid">
          {privacyReadinessItems.map((item) => (
            <article className={item.stance.toLowerCase().replaceAll(" ", "-")} key={item.id}>
              <span>{item.stance}</span>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {accountView === "notifications" ? (
      <section className="panel notification-panel screen-more" id="notifications">
        <div className="notification-layout">
          <div className="notification-copy">
            <p className="eyebrow">Notifications</p>
            <h2>Choose the updates you want</h2>
            <p>Weekly summaries and quiet hours are stored on this device.</p>
          </div>
          <div className="preference-card" aria-label="Notification preferences">
            <label>
              <input
                checked={subscriptionSettings.emailDigest}
                ref={notificationsFirstRef}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, emailDigest: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Weekly digest</strong>
                <small>One roundup for followed models and topics.</small>
              </span>
            </label>
            <label>
              <input
                checked={subscriptionSettings.browserAlerts}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, browserAlerts: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Browser alerts</strong>
                <small>Reserved for important updates after hosted notifications exist.</small>
              </span>
            </label>
            <label>
              <input
                checked={subscriptionSettings.quietHours}
                onChange={(event) =>
                  persistSubscriptionSettings({ ...subscriptionSettings, quietHours: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Quiet hours</strong>
                <small>Keep alerts muted outside useful ownership hours.</small>
              </span>
            </label>
          </div>
          <button className="primary-action workspace-task-action" type="button" onClick={() => setActionMessage("Notification settings saved on this device.")}><span aria-hidden="true">✓</span>Save notification settings</button>
        </div>
        <div className="notification-grid">
          {notificationPreview.map((preview) => (
            <p key={preview}>{preview}</p>
          ))}
        </div>
      </section>
      ) : null}

      <section className="panel screen-community" id="feed">
        <div className="section-head">
          <div>
            <p className="app-kicker">Search notes</p>
            <h2>Owner notes</h2>
          </div>
          <div className="filters" aria-label="Owner note filters">
            <input
              aria-label="Search owner notes"
              ref={communitySearchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brand, model, city, issue..."
              type="search"
            />
            <select aria-label="Filter notes by type" value={selectedLabel} onChange={(event) => setSelectedLabel(event.target.value as KnowledgeLabel | "All")}>
              <option>All</option>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
            <select aria-label="Sort owner notes" value={mode} onChange={(event) => setMode(event.target.value as FeedMode)}>
              <option value="latest">Latest</option>
              <option value="helpful">Most helpful</option>
              <option value="following">Following</option>
              <option value="saved">Saved</option>
            </select>
          </div>
        </div>

        {cityCircles.length ? (
          <div className="city-filter-strip" aria-label="Filter notes by city">
            <span>Filter by city</span>
            {cityCircles.map((circle) => (
              <button
                aria-label={`Show notes from ${circle.city}`}
                aria-pressed={query === circle.city}
                key={circle.city}
                type="button"
                onClick={() => setQuery(query === circle.city ? "" : circle.city)}
              >
                {circle.city} · {circle.posts.length}
              </button>
            ))}
          </div>
        ) : null}

        <div className="content-grid">
          <div className="feed-list">
            {filteredPosts.length ? (
              filteredPosts.map((post) => (
                <article
                  className={`post-card ${selectedPost?.id === post.id ? "is-selected" : ""}`}
                  key={post.id}
                >
                  <button
                    className="post-open-button"
                    type="button"
                    aria-label={`Open owner note: ${post.title}`}
                    onClick={() => openPostDetail(post)}
                  >
                    <span className="pill">{post.label}</span>
                    <h3>{post.title}</h3>
                    <p>
                      {post.brand} {post.model} · {post.city} · {post.odometerKm.toLocaleString("en-IN")} km
                    </p>
                  </button>
                  <button
                    className="save-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSaved(post.id);
                    }}
                  >
                    {saved.has(post.id) ? "Remove saved note" : "Save note"}
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <p>No notes match the current search.</p>
                <button className="save-button" type="button" onClick={() => { setQuery(""); setSelectedLabel("All"); setMode("latest"); }}>Clear note filters</button>
              </div>
            )}
          </div>

          <aside className="detail-card" aria-label="Owner note detail">
            {postDetailOpen && selectedPost ? (
              <>
                <button className="detail-back" type="button" onClick={returnToCommunityFeed}>Back to notes</button>
                <span className="pill">{selectedPost.label}</span>
                <h2 ref={postDetailHeadingRef} tabIndex={-1}>{selectedPost.title}</h2>
                <p className="owner-line">
                  By {selectedPost.author} · {selectedPost.brand} {selectedPost.model} {selectedPost.variant} ·{" "}
                  {selectedPost.city}
                </p>
                <p>{selectedPost.body}</p>
                {selectedPostQuality ? (
                  <div className={`quality-card ${selectedPostQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
                    <div className="quality-meter">
                      <span style={{ width: `${(selectedPostQuality.score / selectedPostQuality.maxScore) * 100}%` }} />
                    </div>
                    <strong>
                      {selectedPostQuality.grade} · {selectedPostQuality.score}/{selectedPostQuality.maxScore}
                    </strong>
                    <p>{selectedPostQuality.strengths[0] ?? "Add car, mileage, and location details to make this note more useful."}</p>
                  </div>
                ) : null}
                <div className="signal-row">
                  <button type="button" onClick={() => markHelpful(selectedPost.id)}>
                    Helpful · {selectedPost.helpful}
                  </button>
                  {selectedPost.label === "Fix" ? (
                    <button type="button" onClick={() => confirmFix(selectedPost.id)}>
                      Worked for me · {selectedPost.fixesConfirmed}
                    </button>
                  ) : null}
                  <button className={saved.has(selectedPost.id) ? "" : "primary-action workspace-task-action"} type="button" onClick={() => toggleSaved(selectedPost.id)}>
                    <span aria-hidden="true">{saved.has(selectedPost.id) ? "−" : "☆"}</span>
                    {saved.has(selectedPost.id) ? "Remove from saved notes" : "Save note"}
                  </button>
                  <button type="button" onClick={() => toggleFollowModel(selectedPost.brand, selectedPost.model)}>
                    {followedModelSet.has(modelKeyFor(selectedPost.brand, selectedPost.model)) ? "Following model" : "Follow model"}
                  </button>
                  <button type="button" onClick={() => toggleFollowTopic(selectedPost.label)}>
                    {followedTopicSet.has(selectedPost.label) ? "Following topic" : "Follow topic"}
                  </button>
                  <button type="button" onClick={shareSelectedPost}>
                    Share note
                  </button>
                  <button type="button" onClick={addSelectedToShortlist}>
                    Add car to shortlist
                  </button>
                </div>
                <div className="comments">
                  <strong>Discussion</strong>
                  {selectedPost.comments.map((comment) => (
                    <p key={comment}>{comment}</p>
                  ))}
                </div>
                <form className="inline-form" onSubmit={addComment}>
                  <textarea
                    aria-label="Write a comment on this note"
                    required
                    rows={3}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Add a useful reply, correction, bill detail, or ownership question."
                  />
                  <button className="save-button" type="submit">
                    Post comment
                  </button>
                </form>
                <form className="inline-form report-form" onSubmit={reportSelectedPost}>
                  <textarea
                    aria-label="Report this owner note"
                    required
                    rows={3}
                    value={reportDraft}
                    onChange={(event) => setReportDraft(event.target.value)}
                    placeholder="Report spam, abuse, fake lead, or dangerous advice."
                  />
                  <button className="save-button" type="submit">
                    Submit report
                  </button>
                </form>
              </>
            ) : (
              <p>Select a post to inspect owner details.</p>
            )}
          </aside>
        </div>
      </section>

      <section className="panel screen-shortlist" id="shortlist">
        <div className="section-head">
          <div>
            <p className="app-kicker">Cars saved</p>
            <h2 ref={shortlistHeadingRef} tabIndex={-1}>Compare cars</h2>
          </div>
        </div>
        <div className="decision-lane-board" aria-label="What to check next">
          {shortlistDecisionLanes.length ? (
            shortlistDecisionLanes.map((lane) => (
              <article className={`decision-lane ${lane.priority.toLowerCase()}`} key={lane.item.id}>
                <div className="decision-lane-meta">
                  <span>Next check</span>
                  <span
                    className={`decision-priority ${lane.priority.toLowerCase()}`}
                    aria-label={`${lane.priority} priority`}
                    title={`${lane.priority} priority`}
                  >
                    <span aria-hidden="true">{lane.priority === "High" ? "!" : lane.priority === "Medium" ? "~" : "-"}</span>
                    {lane.priority} priority
                  </span>
                </div>
                <h3>
                  {lane.item.brand} {lane.item.model}
                </h3>
                <p>{lane.signal}</p>
                <strong>{lane.nextAction}</strong>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p>Add a car to compare owner notes and inspection checks.</p>
              <button className="primary-action workspace-task-action" type="button" onClick={openShortlistComposer}><span aria-hidden="true">+</span>Add first candidate</button>
            </div>
          )}
        </div>
        <div className="shortlist-grid">
          {shortlistFormOpen ? (
          <form className="composer" id="shortlist-form" onSubmit={addShortlistItem}>
            <h3>Add model to compare</h3>
            <div className="form-row">
              <select value={shortlistDraft.brand} onChange={(event) => setShortlistDraft({ ...shortlistDraft, brand: event.target.value })}>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                required
                ref={shortlistModelRef}
                value={shortlistDraft.model}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, model: event.target.value })}
                placeholder="Model"
              />
            </div>
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={shortlistDraft.budget || ""}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, budget: Number(event.target.value) })}
                placeholder="Budget"
              />
              <select
                value={shortlistDraft.status}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, status: event.target.value as ShortlistItem["status"] })}
              >
                {shortlistStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={4}
              value={shortlistDraft.notes}
              onChange={(event) => setShortlistDraft({ ...shortlistDraft, notes: event.target.value })}
              placeholder="Why is it on the list? Dealer quote, family need, must-check concern..."
            />
            <button className="primary-action" type="submit">
              Add to shortlist
            </button>
          </form>
          ) : null}

          {shortlist.length ? (
          <div className="comparison-grid">
            {shortlistComparisons.length ? (
              shortlistComparisons.map((comparison) => {
                const inspection = inspectionChecklistByItemId.get(comparison.item.id);
                return (
                  <article className="comparison-card" key={comparison.item.id}>
                    {inspection ? (
                      <div className="inspection-list">
                        <strong>Inspection checklist</strong>
                        {inspection.checklist.map((item) => (
                          <div className={`inspection-item ${item.priority.toLowerCase()}`} key={item.id}>
                            <span>{item.priority}</span>
                            <div>
                              <b>{item.title}</b>
                              <p>{item.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <span className={`confidence ${comparison.confidence.toLowerCase()}`}>{comparison.confidence} confidence</span>
                    <h3>
                      {comparison.item.brand} {comparison.item.model}
                    </h3>
                    <p>{formatMoney(comparison.item.budget)} target budget</p>
                    <div className="comparison-stats">
                      <span>{comparison.relatedNotes} notes</span>
                      <span>{comparison.ownerReviews} reviews</span>
                      <span>{comparison.knownIssues} issues</span>
                      <span>{comparison.fixes} fixes</span>
                    </div>
                    <div className="form-row">
                      <select
                        value={comparison.item.status}
                        onChange={(event) =>
                          updateShortlistItem(comparison.item.id, { status: event.target.value as ShortlistItem["status"] })
                        }
                      >
                        {shortlistStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                      <button className="save-button" type="button" onClick={() => removeShortlistItem(comparison.item.id)}>
                        Remove car
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={comparison.item.notes}
                      onChange={(event) => updateShortlistItem(comparison.item.id, { notes: event.target.value })}
                      placeholder="Decision notes"
                    />
                  </article>
                );
              })
            ) : (
              <div className="empty-state">Add a car to compare price, owner notes, and inspection checks.</div>
            )}
          </div>
          ) : null}
        </div>
      </section>

      {postComposerOpen ? (
      <section className="panel split-panel screen-community" id="write">
        <div>
          <p className="eyebrow">Publish</p>
          <h2>Write like the next owner depends on it.</h2>
          <p>
            The form pushes users toward the context that makes ownership advice useful: variant, city, odometer, real
            symptoms, costs, and outcomes.
          </p>
          <div className={`quality-card ${draftQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="quality-meter" aria-label={`Draft detail quality ${draftQuality.score} of ${draftQuality.maxScore}`}>
              <span style={{ width: `${(draftQuality.score / draftQuality.maxScore) * 100}%` }} />
            </div>
            <strong>
              Detail meter: {draftQuality.grade} · {draftQuality.score}/{draftQuality.maxScore}
            </strong>
            <div className="quality-prompts">
              {(draftQuality.missingPrompts.length ? draftQuality.missingPrompts : draftQuality.strengths).slice(0, 3).map((prompt) => (
                <p key={prompt}>{prompt}</p>
              ))}
            </div>
          </div>
          <button className="detail-back" type="button" onClick={returnToCommunityFeed}>
            Back to owner notes
          </button>
        </div>
        <form className="composer" onSubmit={publishPost}>
          <input
            aria-label="Post title"
            required
            ref={postTitleRef}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Title"
          />
          <div className="form-row">
            <input
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
              placeholder="Your garage name"
            />
            <select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
            <input
              required
              value={draft.model}
              onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              placeholder="Model"
            />
          </div>
          <div className="form-row">
            <input
              value={draft.variant}
              onChange={(event) => setDraft({ ...draft, variant: event.target.value })}
              placeholder="Variant"
            />
            <input
              value={draft.city}
              onChange={(event) => setDraft({ ...draft, city: event.target.value })}
              placeholder="City"
            />
          </div>
          <input
            min="0"
            type="number"
            value={draft.odometerKm || ""}
            onChange={(event) => setDraft({ ...draft, odometerKm: Number(event.target.value) })}
            placeholder="Odometer km"
          />
          <textarea
            required
            rows={7}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Share symptoms, costs, decisions, failed attempts, and what you would tell the next owner."
          />
          <button className="primary-action" type="submit">
            Publish note
          </button>
        </form>
      </section>
      ) : null}

      <section className="panel screen-garage" id="garage">
        <div className="section-head">
          <div>
            <p className="app-kicker">My car</p>
            <h2 ref={garageHeadingRef} tabIndex={-1}>{currentVehicle?.nickname || "Car records"}</h2>
          </div>
          <button className="save-button" type="button" onClick={exportGarage}>
            Export garage
          </button>
        </div>
        {currentVehicle ? (
          <div className="garage-selected-record" aria-label="Selected vehicle record">
            <div>
              <span className="readout-label">Car</span>
              <h3>{currentVehicle.nickname || `${currentVehicle.brand} ${currentVehicle.model}`}</h3>
              <p>{currentVehicle.brand} {currentVehicle.model} {currentVehicle.variant ? `· ${currentVehicle.variant}` : ""}</p>
            </div>
            <div><span className="readout-label">Odometer</span><strong>{currentVehicle.odometerKm.toLocaleString("en-IN")} km</strong></div>
            <div><span className="readout-label">Logged cost</span><strong>{currentLedger ? formatMoney(currentLedger.totalSpend) : "No spend yet"}</strong></div>
            <div><span className="readout-label">Service due</span><strong>{currentReminder?.title ?? "Nothing due"}</strong></div>
          </div>
        ) : (
          <div className="empty-state garage-empty-state">
            <p>Add your car to see service due dates and running costs.</p>
            <button className="primary-action workspace-task-action" type="button" onClick={openVehicleComposer}><span aria-hidden="true">+</span>Add your vehicle</button>
          </div>
        )}
        {garageForm ? (
        <div className="garage-grid">
          {garageForm === "vehicle" ? (
          <form className="composer" id="vehicle-form" onSubmit={addVehicle}>
            <h3>Add vehicle</h3>
            <input
              ref={vehicleNicknameRef}
              value={vehicleDraft.nickname}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
              placeholder="Nickname"
            />
            <div className="form-row">
              <select value={vehicleDraft.brand} onChange={(event) => setVehicleDraft({ ...vehicleDraft, brand: event.target.value })}>
                {brands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                required
                value={vehicleDraft.model}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
                placeholder="Model"
              />
            </div>
            <div className="form-row">
              <input
                value={vehicleDraft.variant}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, variant: event.target.value })}
                placeholder="Variant"
              />
              <input
                value={vehicleDraft.city}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, city: event.target.value })}
                placeholder="City"
              />
            </div>
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={vehicleDraft.odometerKm || ""}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, odometerKm: Number(event.target.value) })}
                placeholder="Current odometer"
              />
              <input
                type="month"
                value={vehicleDraft.purchaseMonth}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, purchaseMonth: event.target.value })}
                aria-label="Purchase month"
              />
            </div>
            <button className="primary-action" type="submit">
              Save vehicle
            </button>
          </form>
          ) : null}

          {garageForm === "record" && currentVehicle ? (
          <form className="composer" id="timeline-form" onSubmit={addTimelineNote}>
            <h3>Add service or cost record</h3>
            <select
              required
              value={timelineDraft.vehicleId}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, vehicleId: event.target.value })}
            >
              {garage.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.nickname || vehicle.model}
                </option>
              ))}
            </select>
            <div className="form-row">
              <select
                value={timelineDraft.kind}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, kind: event.target.value as TimelineEntryKind })}
              >
                {timelineKinds.map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <input
                type="date"
                value={timelineDraft.happenedOn}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, happenedOn: event.target.value })}
                aria-label="Record date"
              />
            </div>
            <input
              required
              ref={timelineTitleRef}
              value={timelineDraft.title}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, title: event.target.value })}
              placeholder="Service, repair, fuel, or other record"
            />
            <div className="form-row">
              <input
                min="0"
                type="number"
                value={timelineDraft.amount || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
                placeholder="Amount paid"
              />
              <input
                min="0"
                type="number"
                value={timelineDraft.odometerKm || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
                placeholder="Odometer"
              />
            </div>
            <textarea
              rows={4}
              value={timelineDraft.note}
              onChange={(event) => setTimelineDraft({ ...timelineDraft, note: event.target.value })}
              placeholder="Bill details, symptoms, shop notes, or what you would do differently."
            />
            <button className="primary-action" type="submit">
              Save record
            </button>
          </form>
          ) : null}
        </div>
        ) : null}

        {currentVehicle ? (
        <>
        <div className="reminder-board" aria-label="Service due">
          {garageReminders.length ? (
            garageReminders.map((reminder) => (
              <article className={`reminder-card ${reminder.urgency.toLowerCase()}`} key={reminder.id}>
                <span>{reminder.urgency}</span>
                <h3>{reminder.title}</h3>
                <p>
                  {reminder.vehicleName}: {reminder.detail}
                </p>
              </article>
            ))
          ) : (
            <div className="empty-state">Nothing is due. Add a service or insurance record to keep dates current.</div>
          )}
        </div>

        <div className="timeline-board">
          {garage.map((vehicle) => (
            <article className="vehicle-card" key={vehicle.id}>
              <span className="pill">{vehicle.brand}</span>
              <h3>{vehicle.nickname}</h3>
              <p>
                {vehicle.model} {vehicle.variant} · {vehicle.city} · {vehicle.odometerKm.toLocaleString("en-IN")} km
              </p>
              {timeline
                .filter((entry) => entry.vehicleId === vehicle.id)
                .slice(0, 3)
                .map((entry) => (
                  <div className="timeline-entry" key={entry.id}>
                    <strong>
                      {entry.kind}: {entry.title}
                    </strong>
                    <span>
                      {formatMoney(entry.amount)} · {entry.odometerKm.toLocaleString("en-IN")} km · {entry.happenedOn}
                    </span>
                    <p>{entry.note}</p>
                  </div>
                ))}
            </article>
          ))}
        </div>

        <div className="ledger-board" aria-label="Running costs">
          {garageCostLedger.map((ledger) => (
            <article className="ledger-card" key={ledger.vehicle.id}>
              <span>{ledger.vehicle.brand}</span>
              <h3>{ledger.vehicle.nickname || ledger.vehicle.model}</h3>
              <div className="ledger-stats">
                <p>
                  <strong>{formatMoney(ledger.totalSpend)}</strong>
                  <small>Total logged</small>
                </p>
                <p>
                  <strong>{ledger.costPerKm === null ? "—" : `${formatMoney(ledger.costPerKm, 2)}/km`}</strong>
                  <small>Approx cost/km</small>
                </p>
                <p>
                  <strong>{ledger.entryCount}</strong>
                  <small>Records</small>
                </p>
              </div>
              <p>
                {ledger.latestEntry
                  ? `Latest: ${ledger.latestEntry.kind.toLowerCase()} · ${ledger.latestEntry.title}`
                  : "No costs recorded. Add service, repair, tyre, fuel, or insurance costs."}
              </p>
            </article>
          ))}
        </div>
        </>
        ) : null}
      </section>

      {shortlist.length ? (
      <section className="panel screen-shortlist" id="notebooks">
        <div className="section-head">
          <div>
            <p className="eyebrow">Owner notes by car</p>
            <h2>Notes for cars you are comparing</h2>
          </div>
        </div>
        <div className="notebook-grid">
          {notebooks.map((notebook) => {
            const isFollowing = followedModelSet.has(notebook.key);
            return (
              <article className="notebook-card" key={notebook.key}>
                <span className="pill">{notebook.brand}</span>
                <h3>{notebook.model}</h3>
                <p>{notebook.posts.length} owner notes</p>
                <button className="save-button" type="button" onClick={() => toggleFollowModel(notebook.brand, notebook.model)}>
                  {isFollowing ? "Following" : "Follow model"}
                </button>
                <button className="save-button" type="button" onClick={() => shareModelNotebook(notebook.brand, notebook.model)}>
                  Share notes
                </button>
                <div className="notebook-tags">
                  {knowledgeLabels
                    .filter((label) => notebook.posts.some((post) => post.label === label))
                    .map((label) => (
                      <button key={label} type="button" onClick={() => toggleFollowTopic(label)}>
                        {followedTopicSet.has(label) ? `Following ${label}` : label}
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      ) : null}

      <section className="panel moderation-panel screen-more" id="moderation">
        <div className="section-head">
          <div>
            <p className="eyebrow">Moderator bay</p>
            <h2>Trust tools before scale tools.</h2>
          </div>
          <div className="moderation-stats">
            <span>{moderationSummary.openReports} open</span>
            <span>{moderationSummary.dismissedReports} dismissed</span>
            <span>{moderationSummary.removedReports} removed</span>
          </div>
        </div>
        <div className="moderation-grid">
          {reports.length ? (
            reports.map((report) => (
              <article className={`report-card ${report.status.toLowerCase()}`} key={report.id}>
                <span>{report.status}</span>
                <h3>{report.postTitle}</h3>
                <p>{report.reason}</p>
                <small>
                  Reported by {report.reporterName} · {new Date(report.createdAt).toLocaleDateString("en-IN")}
                </small>
                <div className="signal-row">
                  <button type="button" onClick={() => setReportStatus(report.id, "Dismissed")}>
                    Dismiss
                  </button>
                  <button type="button" onClick={() => removeReportedPost(report)}>
                    Remove post
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">No reports yet. The queue is ready before the community needs it.</div>
          )}
        </div>
      </section>

      <nav className="mobile-dock" aria-label="Primary mobile navigation">
        <a className={activeNav === "home" ? "is-active" : ""} href="#top" aria-current={activeNav === "home" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
          <span className="shell-icon" aria-hidden="true">⌂</span>
          <span>Today</span>
        </a>
        <a className={activeNav === "shortlist" ? "is-active" : ""} href="#shortlist" aria-current={activeNav === "shortlist" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("shortlist"); }}>
          <span className="shell-icon" aria-hidden="true">▤</span>
          <span>Shortlist</span>
          {shortlist.length ? <strong>{shortlist.length}</strong> : null}
        </a>
        <a className={activeNav === "garage" ? "is-active" : ""} href="#garage" aria-current={activeNav === "garage" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("garage"); }}>
          <span className="shell-icon" aria-hidden="true">▣</span>
          <span>Garage</span>
          {garage.length ? <strong>{garage.length}</strong> : null}
        </a>
        <a className={activeNav === "community" ? "is-active" : ""} href="#feed" aria-current={activeNav === "community" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("community", "community", "latest"); }}>
          <span className="shell-icon" aria-hidden="true">◉</span>
          <span>Community</span>
        </a>
      </nav>

    </main>
  );
}
