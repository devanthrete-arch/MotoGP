import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Bookmark,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Cloud,
  Download,
  Gauge,
  House,
  IndianRupee,
  ListChecks,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  loadCloudCommunity,
  publishCloudComment,
  publishCloudPost,
  publishCloudReport,
  setCloudSavedPost,
} from "./communityApi";
import {
  getCloudSession,
  loadCloudBackup,
  saveCloudBackup,
  sendCloudSignInLink,
  signOutCloud,
} from "./cloudSync";
import {
  knowledgeLabels,
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
  buildShortlistComparisons,
  buildShortlistDecisionLanes,
  filterPostsByMode,
  formatMoney,
  groupByModel,
  modelKeyFor,
} from "./insights";
import {
  buildAutoflexBackup,
  clearAutoflexData,
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
  parseAutoflexBackup,
  restoreAutoflexBackup,
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
import {
  accountPaths,
  getInitialRoute,
  routeFromPath,
  routeFromHash,
  titleForPath,
  workspacePaths,
  type AccountView,
  type AppRoute,
  type WorkspaceScreen,
} from "./routing";
import { modelsForBrand, vehicleBrands } from "./vehicleCatalog";
import { getSupabaseClient, isCloudSyncConfigured } from "./supabase";

type FeedMode = "latest" | "helpful" | "saved" | "following";

const cloudOwnerKey = "autoflex.cloud-owner.v1";

const readCloudOwner = (): string => {
  try {
    return window.localStorage.getItem(cloudOwnerKey) ?? "";
  } catch {
    return "";
  }
};

const writeCloudOwner = (userId: string | null): void => {
  try {
    if (userId) window.localStorage.setItem(cloudOwnerKey, userId);
    else window.localStorage.removeItem(cloudOwnerKey);
  } catch {
    // Account sync remains usable for the current session when browser storage is blocked.
  }
};

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
  const location = useLocation();
  const navigate = useNavigate();
  const initialRoute = useRef<AppRoute>(location.pathname === "/" && location.hash ? getInitialRoute() : routeFromPath(location.pathname));
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
  const [accountView, setAccountView] = useState<AccountView>(initialRoute.current.accountView ?? "profile");
  const [vehicleMenuOpen, setVehicleMenuOpen] = useState(false);
  const [shortlistFormOpen, setShortlistFormOpen] = useState(false);
  const [garageForm, setGarageForm] = useState<"vehicle" | "record" | null>(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [postComposerOpen, setPostComposerOpen] = useState(Boolean(initialRoute.current.openComposer));
  const [activeNav, setActiveNav] = useState(initialRoute.current.nav);
  const [activeScreen, setActiveScreen] = useState<WorkspaceScreen>(initialRoute.current.screen);
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudUser, setCloudUser] = useState<{ email: string; id: string } | null>(null);
  const [cloudBackupUpdatedAt, setCloudBackupUpdatedAt] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudReadyToSync, setCloudReadyToSync] = useState(false);
  const [cloudPostIds, setCloudPostIds] = useState<Set<string>>(new Set());
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
  const restoreBackupRef = useRef<HTMLInputElement>(null);
  const clearDataTriggerRef = useRef<HTMLButtonElement>(null);
  const clearDataCancelRef = useRef<HTMLButtonElement>(null);
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
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;

    const syncSession = async (session: Awaited<ReturnType<typeof getCloudSession>>) => {
      if (!active) return;
      const user = session?.user;
      setCloudUser(user ? { email: user.email ?? "Signed-in user", id: user.id } : null);
      if (!user) {
        setCloudBackupUpdatedAt(null);
        setCloudReadyToSync(false);
        return;
      }
      try {
        const backup = await loadCloudBackup(user.id);
        if (active) {
          if (!backup) writeCloudOwner(user.id);
          setCloudBackupUpdatedAt(backup?.updatedAt ?? null);
          setCloudReadyToSync(!backup || readCloudOwner() === user.id);
        }
      } catch {
        if (active) setActionMessage("We could not check your saved account data just now.");
      }
    };

    void getCloudSession().then(syncSession).catch(() => {
      if (active) setActionMessage("Sign-in status could not be loaded.");
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void syncSession(session), 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isCloudSyncConfigured) return;
    let active = true;
    void loadCloudCommunity()
      .then((community) => {
        if (!active) return;
        setCloudPostIds(community.postIds);
        if (!community.posts.length) return;
        setPosts((current) => {
          const remoteIds = community.postIds;
          const merged = [...community.posts, ...current.filter((post) => !remoteIds.has(post.id))];
          savePosts(merged);
          return merged;
        });
      })
      .catch(() => setActionMessage("Community updates could not be loaded. Showing saved notes instead."));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cloudUser || !cloudReadyToSync) return;
    const timeout = window.setTimeout(() => {
      void saveCloudBackup(cloudUser.id, buildAutoflexBackup())
        .then((updatedAt) => setCloudBackupUpdatedAt(updatedAt))
        .catch(() => setActionMessage("Changes are safe on this device. We could not update your account just now."));
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [cloudReadyToSync, cloudUser, follows, garage, posts, profile, reports, saved, shortlist, subscriptionSettings, timeline]);

  useEffect(() => {
      if (location.hash) {
        const legacyRoute = routeFromHash(location.hash);
        const legacyPath = legacyRoute.openComposer
          ? "/community/new"
          : legacyRoute.screen === "account"
            ? accountPaths[legacyRoute.accountView ?? "profile"]
            : workspacePaths[legacyRoute.screen];
        navigate(legacyPath, { replace: true });
        return;
      }
      const route = routeFromPath(location.pathname);
      setActiveScreen(route.screen);
      setActiveNav(route.nav);
      if (route.accountView) setAccountView(route.accountView);
      setPostComposerOpen(Boolean(route.openComposer));
      const noteId = location.pathname.match(/^\/community\/([^/]+)$/)?.[1];
      const routedPost = noteId ? posts.find((post) => post.id === decodeURIComponent(noteId)) : null;
      if (routedPost) {
        setSelectedPost(routedPost);
        setPostDetailOpen(true);
      } else {
        setPostDetailOpen(false);
      }
      document.title = titleForPath(location.pathname);
      window.scrollTo(0, 0);
  }, [location.hash, location.pathname, navigate, posts]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  useEffect(() => {
    if (!postComposerOpen) return;
    const timeout = window.setTimeout(() => {
      postTitleRef.current?.scrollIntoView({ block: "center" });
      postTitleRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [postComposerOpen]);

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
    if (cloudUser && cloudPostIds.has(postId)) {
      void setCloudSavedPost(cloudUser.id, postId, !wasSaved).catch(() => {
        setActionMessage("Saved on this device. We will try your account again later.");
      });
    }
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
    if (cloudUser && cloudPostIds.has(selectedPost.id)) {
      void publishCloudComment(cloudUser.id, selectedPost.id, author, commentDraft.trim()).catch(() => {
        setActionMessage("Comment saved on this device, but could not be shared yet.");
      });
      setActionMessage("Comment posted.");
    } else {
      setActionMessage("Comment saved on this device. Sign in to share it with Community.");
    }
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
    if (cloudUser && cloudPostIds.has(selectedPost.id)) {
      void publishCloudReport(cloudUser.id, report).catch(() => {
        setActionMessage("Report saved on this device, but could not be sent yet.");
      });
      setActionMessage("Report sent to moderators.");
    } else {
      setActionMessage("Report saved on this device. Sign in to send it to moderators.");
    }
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

  const downloadBackup = () => {
    try {
      const payload = JSON.stringify(buildAutoflexBackup(), null, 2);
      const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `autoflex-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setActionMessage("Your Autoflex data copy was downloaded.");
    } catch {
      setActionMessage("Your data copy could not be downloaded in this browser.");
    }
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const backup = parseAutoflexBackup(await file.text());
      if (!backup) {
        setActionMessage("That file is not a valid Autoflex data copy.");
        return;
      }

      restoreAutoflexBackup(backup);
      setActionMessage("Data imported. Reloading Autoflex.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      setActionMessage("That data copy could not be read.");
    }
  };

  const clearAllData = () => {
    setCloudReadyToSync(false);
    writeCloudOwner(null);
    clearAutoflexData();
    setConfirmClearData(false);
    window.location.reload();
  };

  const requestCloudSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = cloudEmail.trim();
    if (!email) return;
    setCloudBusy(true);
    try {
      await sendCloudSignInLink(email);
      setActionMessage("Sign-in link sent. Check your email.");
    } catch {
      setActionMessage("The sign-in link could not be sent. Try again.");
    } finally {
      setCloudBusy(false);
    }
  };

  const uploadCloudBackup = async () => {
    if (!cloudUser) return;
    setCloudBusy(true);
    try {
      const updatedAt = await saveCloudBackup(cloudUser.id, buildAutoflexBackup());
      writeCloudOwner(cloudUser.id);
      setCloudReadyToSync(true);
      setCloudBackupUpdatedAt(updatedAt);
      setActionMessage("Your Autoflex data is saved to your account.");
    } catch {
      setActionMessage("Your data is safe on this device, but we could not update your account.");
    } finally {
      setCloudBusy(false);
    }
  };

  const restoreCloudData = async () => {
    if (!cloudUser) return;
    setCloudBusy(true);
    try {
      const cloudBackup = await loadCloudBackup(cloudUser.id);
      const backup = cloudBackup ? parseAutoflexBackup(JSON.stringify(cloudBackup.payload)) : null;
      if (!backup) {
        setActionMessage("No saved account data was found.");
        return;
      }
      restoreAutoflexBackup(backup);
      writeCloudOwner(cloudUser.id);
      setCloudReadyToSync(true);
      setActionMessage("Account data restored. Reloading Autoflex.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      setActionMessage("Account restore failed. This device was not changed.");
    } finally {
      setCloudBusy(false);
    }
  };

  const disconnectCloud = async () => {
    setCloudBusy(true);
    try {
      await signOutCloud();
      writeCloudOwner(null);
      setCloudUser(null);
      setCloudBackupUpdatedAt(null);
      setCloudReadyToSync(false);
      setActionMessage("Signed out. Local Autoflex data remains on this device.");
    } catch {
      setActionMessage("Could not sign out. Try again.");
    } finally {
      setCloudBusy(false);
    }
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
    if (cloudUser) {
      void publishCloudPost(cloudUser.id, post)
        .then(() => setCloudPostIds((current) => new Set(current).add(post.id)))
        .catch(() => setActionMessage("Note saved on this device, but could not be shared yet."));
    }
    setSelectedPost(post);
    setPostDetailOpen(true);
    setPostComposerOpen(false);
    setDraft(initialDraft);
    setActionMessage(cloudUser ? "Owner note published." : "Note saved on this device. Sign in to publish it to Community.");
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

  const updateRoute = (path: string) => {
    if (`${location.pathname}${location.search}` !== path) navigate(path);
  };

  const openWorkspace = (
    screen: Exclude<WorkspaceScreen, "account">,
    nav: string = screen,
    nextMode?: FeedMode,
    path: string = workspacePaths[screen],
  ) => {
    if (nextMode) setMode(nextMode);
    setActiveScreen(screen);
    setActiveNav(nav);
    setPostComposerOpen(false);
    setPostDetailOpen(false);
    updateRoute(path);
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
    updateRoute(accountPaths[view]);
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
    const returnScreen = accountReturnScreenRef.current;
    openWorkspace(returnScreen === "account" ? "home" : returnScreen);
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
    updateRoute(`/community/${encodeURIComponent(post.id)}`);
    window.requestAnimationFrame(() => {
      document.querySelector(".detail-card")?.scrollIntoView({ block: "start" });
      postDetailHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const openPostComposer = () => {
    openWorkspace("community", "community", undefined, "/community/new");
    setPostComposerOpen(true);
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

  const openInsuranceRecordComposer = () => {
    if (!currentVehicle) {
      openVehicleComposer();
      return;
    }
    setTimelineDraft((current) => ({
      ...current,
      vehicleId: currentVehicle.id,
      kind: "Insurance",
      title: "Insurance renewal",
    }));
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
    updateRoute("/community");
    document.getElementById("feed")?.scrollIntoView({ block: "start" });
    communitySearchRef.current?.focus({ preventScroll: true });
  };

  const currentVehicle = garage.find((vehicle) => vehicle.id === timelineDraft.vehicleId) ?? garage[0] ?? null;
  const currentReminder = garageReminders.find((reminder) => reminder.vehicleId === currentVehicle?.id) ?? garageReminders[0] ?? null;
  const currentLedger = garageCostLedger.find((ledger) => ledger.vehicle.id === currentVehicle?.id) ?? null;
  const isFirstRun = garage.length === 0 && shortlist.length === 0;
  const workspaceCopy: Record<WorkspaceScreen, { eyebrow: string; title: string; detail: string }> = {
    home: { eyebrow: "Today", title: "Today", detail: "Your car's next task." },
    shortlist: { eyebrow: "Choosing a car", title: "Shortlist", detail: `${shortlist.length} car${shortlist.length === 1 ? "" : "s"} saved to compare.` },
    garage: { eyebrow: "My cars", title: "Garage", detail: currentVehicle ? "Service, costs, and records." : "Add a car to get started." },
    community: { eyebrow: "From owners", title: "Community", detail: `${filteredPosts.length} matching note${filteredPosts.length === 1 ? "" : "s"}.` },
    account:
      accountView === "profile"
        ? { eyebrow: "Account", title: "Profile", detail: "Your name, city, and role." }
        : accountView === "saved"
          ? { eyebrow: "Profile", title: "Saved notes", detail: "Notes saved for later." }
          : accountView === "following"
            ? { eyebrow: "Profile", title: "Following", detail: "Cars and topics you follow." }
        : accountView === "notifications"
          ? { eyebrow: "Account", title: "Notifications", detail: "Choose your updates." }
          : { eyebrow: "Account", title: "Settings", detail: "Data, privacy, and preferences." },
  };
  const accountBackLabel =
    accountView !== "profile"
      ? "Back to Profile"
      : `Back to ${accountReturnScreenRef.current === "home" ? "Today" : accountReturnScreenRef.current === "shortlist" ? "Shortlist" : accountReturnScreenRef.current === "garage" ? "Garage" : "Community"}`;
  return (
    <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <main className="app-shell" data-screen={activeScreen} id="main-content">
      <aside className="desktop-rail" aria-label="Autoflex navigation">
        <a className="rail-brand" href="/" aria-label="Autoflex Today" onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
          <span className="brand-mark" aria-hidden="true">A</span>
          <span className="brand-word">Auto<strong>flex</strong></span>
        </a>
        <p className="rail-kicker">Own with confidence</p>
        <nav className="rail-nav" aria-label="Primary destinations">
          <a className={activeNav === "home" ? "is-active" : ""} href="/" aria-current={activeNav === "home" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
            <House className="shell-icon" aria-hidden="true" />
            <span>Today</span>
          </a>
          <a className={activeNav === "shortlist" ? "is-active" : ""} href="/shortlist" aria-current={activeNav === "shortlist" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("shortlist"); }}>
            <ListChecks className="shell-icon" aria-hidden="true" />
            <span>Shortlist</span>
            <strong>{shortlist.length}</strong>
          </a>
          <a className={activeNav === "garage" ? "is-active" : ""} href="/garage" aria-current={activeNav === "garage" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("garage"); }}>
            <CarFront className="shell-icon" aria-hidden="true" />
            <span>Garage</span>
            <strong>{garage.length}</strong>
          </a>
          <a className={activeNav === "community" ? "is-active" : ""} href="/community" aria-current={activeNav === "community" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("community", "community", "latest"); }}>
            <MessageCircle className="shell-icon" aria-hidden="true" />
            <span>Community</span>
          </a>
        </nav>
        <div className="rail-status">
          <span className={`status-dot ${connectionStatus.tone}`} aria-hidden="true" />
          <div>
            <strong>{connectionStatus.label}</strong>
            <small>Your records stay available offline.</small>
          </div>
        </div>
      </aside>

      <header className="nav app-topbar">
        <nav aria-label="Page and account navigation">
          <a className="brand" href="/" aria-label="Autoflex Today" onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
            <span className="brand-word">Auto<strong>flex</strong></span>
          </a>
          <div className="nav-context" aria-label="Today summary">
            <span>{workspaceCopy[activeScreen].eyebrow}</span>
            <strong>{workspaceCopy[activeScreen].title}</strong>
          </div>
          <button aria-label="Open Profile" className="account-button" type="button" onClick={(event) => openProfile(event.currentTarget)}>
            <CircleUserRound aria-hidden="true" />
            <strong>Profile</strong>
          </button>
        </nav>
      </header>

      {!isOnline ? <div className="offline-banner" role="status">You are offline. Saved records remain available on this device.</div> : null}

      <section className="hero screen-home">
        <div className="home-workbench" id="top">
          <div className="home-toolbar">
            <div>
              <p className="app-kicker">Today</p>
              <h1>{currentVehicle ? `${currentVehicle.nickname || currentVehicle.model}, at a glance` : "How do you want to use Autoflex?"}</h1>
              <p className="home-status">{currentVehicle ? "Maintenance, costs, and what owners report in one place." : "Start with the car you own or the cars you are considering."}</p>
            </div>
            <div className="home-toolbar-actions">
              {isFirstRun ? (
                <div className="first-run-actions" aria-label="Choose how to start">
                  <button className="primary-action first-run-action" type="button" onClick={openVehicleComposer}>
                    <CarFront aria-hidden="true" />
                    <span><small>I already own a car</small>Add my car</span>
                  </button>
                  <button className="save-button first-run-action" type="button" onClick={openShortlistComposer}>
                    <ListChecks aria-hidden="true" />
                    <span><small>I'm buying a car</small>Start my shortlist</span>
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
                    <ChevronDown aria-hidden="true" />
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
                        <span aria-hidden="true">{vehicle.id === currentVehicle.id ? <Check /> : null}</span>
                        <span><strong>{vehicle.nickname || vehicle.model}</strong><small>{vehicle.brand} {vehicle.model}{vehicle.variant ? ` · ${vehicle.variant}` : ""}</small></span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {!isFirstRun ? (
                <button className="save-button workspace-task-action" type="button" onClick={openVehicleComposer}>
                  <Plus aria-hidden="true" />
                  Add another car
                </button>
              ) : null}
            </div>
          </div>
          {isFirstRun ? (
            <div className="first-run-note">Choose one path to begin. You can add the other later.</div>
          ) : (
          <div className="home-work-grid">
            <article className="next-action-card">
              <div className="next-action-copy">
                <span className="readout-label">Next action</span>
                <h2>{currentReminder?.title ?? "Add your car"}</h2>
                <p>{currentReminder?.detail ?? "Add one vehicle to track service, repairs, and costs."}</p>
                <button
                  className="save-button"
                  type="button"
                  onClick={currentReminder?.title.toLowerCase().includes("insurance") ? openInsuranceRecordComposer : openGarageRecordComposer}
                >
                  <Wrench aria-hidden="true" />
                  {currentReminder?.title.toLowerCase().includes("insurance") ? "Log insurance details" : "Add service record"}
                </button>
              </div>
              <img
                alt="Petrol teal compact SUV in a clean service bay"
                className="vehicle-visual"
                decoding="async"
                height="941"
                loading="lazy"
                sizes="(max-width: 600px) 100vw, (max-width: 1080px) 45vw, 385px"
                src="/autoflex-garage.jpg"
                width="1672"
              />
            </article>
            <aside className="home-readout" aria-label="Current car summary">
              <div><Gauge aria-hidden="true" /><span className="readout-label">Odometer</span><strong>{currentVehicle ? `${currentVehicle.odometerKm.toLocaleString("en-IN")} km` : "--"}</strong></div>
              <div><IndianRupee aria-hidden="true" /><span className="readout-label">Total spent</span><strong>{currentLedger ? formatMoney(currentLedger.totalSpend) : "--"}</strong></div>
              <div><ListChecks aria-hidden="true" /><span className="readout-label">Things due soon</span><strong>{shortlistDecisionLanes.filter((lane) => lane.priority === "High").length + garageReminders.filter((reminder) => reminder.urgency === "Soon").length}</strong></div>
            </aside>
          </div>
          )}
        </div>
      </section>

      {actionMessage ? (
        <div aria-atomic="true" className="action-message" role="status">
          {actionMessage}
        </div>
      ) : null}

      <section className="workspace-header" aria-label={`${workspaceCopy[activeScreen].title} screen`}>
        <div>
          {activeScreen === "account" ? <button className="detail-back" type="button" onClick={returnFromAccount}>{accountBackLabel}</button> : null}
          <p className="app-kicker">{workspaceCopy[activeScreen].eyebrow}</p>
          <h2
            ref={activeScreen === "account" ? (accountView === "settings" ? settingsHeadingRef : accountHeaderRef) : undefined}
            tabIndex={activeScreen === "account" ? -1 : undefined}
          >
            {workspaceCopy[activeScreen].title}
          </h2>
          <p>{workspaceCopy[activeScreen].detail}</p>
        </div>
        <div className="workspace-header-actions">
          {activeScreen === "shortlist" && shortlist.length && !shortlistFormOpen ? <button className="primary-action workspace-task-action" type="button" onClick={openShortlistComposer}><Plus aria-hidden="true" />Add car</button> : null}
          {activeScreen === "garage" && currentVehicle && garageForm === null ? <button className="primary-action workspace-task-action" type="button" onClick={openGarageRecordComposer}><Plus aria-hidden="true" />Add service record</button> : null}
          {activeScreen === "community" && !postComposerOpen && !postDetailOpen ? <button className="primary-action workspace-task-action" type="button" onClick={openPostComposer}><Plus aria-hidden="true" />Write a note</button> : null}
        </div>
      </section>

      <section className="panel recent-activity-panel screen-home" aria-label="Recent useful activity">
        <div className="section-head">
          <div>
            <p className="eyebrow">New in Community</p>
            <h2>Recent owner notes</h2>
          </div>
          <button className="save-button" type="button" onClick={() => openWorkspace("community", "community", "latest")}>
            <Search aria-hidden="true" />
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
            aria-label="Display name"
            ref={profileNameRef}
            value={profile.displayName}
            onChange={(event) => persistProfile({ ...profile, displayName: event.target.value })}
            placeholder="Display name"
          />
          <div className="form-row">
            <input
              aria-label="City"
              value={profile.city}
              onChange={(event) => persistProfile({ ...profile, city: event.target.value })}
              placeholder="City"
            />
            <select
              aria-label="Garage role"
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
          <button className="primary-action workspace-task-action" type="submit"><Check aria-hidden="true" />Save profile</button>
        </form>
        <nav className="profile-utility-list" aria-label="Profile sections">
          <button type="button" onClick={() => openAccountView("saved")}><Bookmark aria-hidden="true" /><span><strong>Saved notes</strong><small>{saved.size} note{saved.size === 1 ? "" : "s"}</small></span><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => openAccountView("following")}><UsersRound aria-hidden="true" /><span><strong>Following</strong><small>{follows.models.length + follows.topics.length} cars and topics</small></span><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => openAccountView("notifications")}><Bell aria-hidden="true" /><span><strong>Notifications</strong><small>Weekly updates and quiet hours</small></span><ChevronRight aria-hidden="true" /></button>
          <button type="button" onClick={() => openAccountView("settings")}><Settings aria-hidden="true" /><span><strong>Settings</strong><small>Data, privacy, and app preferences</small></span><ChevronRight aria-hidden="true" /></button>
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
          {!saved.size ? <div className="empty-state">Nothing saved yet. Save a useful note from Community to keep it here.</div> : null}
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
          {!follows.models.length && !follows.topics.length ? <div className="empty-state">Nothing followed yet. Follow a car or topic from Community to see it here.</div> : null}
        </div>
      </section>
      ) : null}

      {accountView === "settings" ? (
      <section className="panel settings-panel screen-more" id="privacy">
        {isCloudSyncConfigured ? (
        <div className="settings-group cloud-sync-group">
          <div className="settings-group-title cloud-sync-title">
            <Cloud aria-hidden="true" />
            <div>
              <h3>Use Autoflex on another device</h3>
              <p>Sign in with your email to keep your garage, shortlist, and saved notes with your account.</p>
            </div>
          </div>
          {cloudUser ? (
            <div className="cloud-sync-account">
              <div className="cloud-sync-status">
                <span>Signed in as</span>
                <strong>{cloudUser.email}</strong>
                <small>
                  {cloudBackupUpdatedAt
                    ? `Last saved ${new Date(cloudBackupUpdatedAt).toLocaleString()}`
                    : "Nothing saved to this account yet"}
                </small>
              </div>
              <div className="cloud-sync-actions">
                <button className="primary-action" disabled={cloudBusy} type="button" onClick={uploadCloudBackup}>
                  <Cloud aria-hidden="true" />
                  {cloudBackupUpdatedAt ? "Save latest changes" : "Save to my account"}
                </button>
                <button className="save-button" disabled={cloudBusy || !cloudBackupUpdatedAt} type="button" onClick={restoreCloudData}>
                  <RefreshCw aria-hidden="true" />Use saved data here
                </button>
                <button className="cloud-sign-out" disabled={cloudBusy} type="button" onClick={disconnectCloud}>
                  <LogOut aria-hidden="true" />Sign out
                </button>
              </div>
            </div>
          ) : (
            <form className="cloud-sync-form" onSubmit={requestCloudSignIn}>
              <label htmlFor="cloud-email">Email address</label>
              <div>
                <input
                  autoComplete="email"
                  id="cloud-email"
                  inputMode="email"
                  onChange={(event) => setCloudEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={cloudEmail}
                />
                <button className="primary-action" disabled={cloudBusy} type="submit">
                  <Cloud aria-hidden="true" />Email me a sign-in link
                </button>
              </div>
              <small>No password required. We will email you a secure sign-in link.</small>
            </form>
          )}
        </div>
        ) : null}

        <div className="settings-group">
          <div className="settings-group-title">
            <div>
              <h3>Move your data</h3>
              <p>Download a copy for your records or bring an Autoflex copy onto this device.</p>
            </div>
          </div>
          <div className="settings-action-list">
            <button type="button" onClick={downloadBackup}>
              <Download aria-hidden="true" />
              <span><strong>Download a copy</strong><small>Keep your Autoflex data as a file</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <button type="button" onClick={() => restoreBackupRef.current?.click()}>
              <Upload aria-hidden="true" />
              <span><strong>Import a copy</strong><small>Use Autoflex data from another device</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
            <input
              accept="application/json,.json"
              aria-hidden="true"
              className="visually-hidden"
              hidden
              onChange={restoreBackup}
              ref={restoreBackupRef}
              tabIndex={-1}
              type="file"
            />
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">
            <div>
              <h3>Preferences</h3>
              <p>Choose how Autoflex behaves on this device.</p>
            </div>
          </div>
          <div className="settings-action-list">
            <button type="button" onClick={() => openAccountView("notifications")}>
              <Bell aria-hidden="true" />
              <span><strong>Notifications</strong><small>Weekly updates, browser alerts, and quiet hours</small></span>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="settings-group settings-danger-zone">
          <div className="settings-group-title">
            <div>
              <h3>Clear Autoflex data</h3>
              <p>Removes your profile, garage, shortlist, saved notes, and preferences from this browser.</p>
            </div>
          </div>
          {confirmClearData ? (
            <div className="settings-confirm" role="alert">
              <strong>This cannot be undone unless you downloaded a backup.</strong>
              <div>
                <button
                  className="save-button"
                  ref={clearDataCancelRef}
                  type="button"
                  onClick={() => {
                    setConfirmClearData(false);
                    window.requestAnimationFrame(() => clearDataTriggerRef.current?.focus());
                  }}
                >
                  Cancel
                </button>
                <button className="danger-action" type="button" onClick={clearAllData}><Trash2 aria-hidden="true" />Clear all data</button>
              </div>
            </div>
          ) : (
            <button
              className="danger-link"
              ref={clearDataTriggerRef}
              type="button"
              onClick={() => {
                setConfirmClearData(true);
                window.requestAnimationFrame(() => clearDataCancelRef.current?.focus());
              }}
            >
              <Trash2 aria-hidden="true" />
              Clear data on this device
            </button>
          )}
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
          <button className="primary-action workspace-task-action" type="button" onClick={() => setActionMessage("Notification settings saved on this device.")}><Check aria-hidden="true" />Save notification settings</button>
        </div>
        <div className="notification-grid">
          {notificationPreview.map((preview) => (
            <p key={preview}>{preview}</p>
          ))}
        </div>
      </section>
      ) : null}

      <section className={`panel screen-community ${postDetailOpen ? "is-detail-open" : ""}`} id="feed">
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
                  <Link
                    className="post-open-button"
                    to={`/community/${encodeURIComponent(post.id)}`}
                    aria-label={`Read owner note: ${post.title}`}
                    onClick={() => setSelectedPost(post)}
                  >
                    <span className="pill">{post.label}</span>
                    <h3>{post.title}</h3>
                    <p>
                      {post.brand} {post.model} · {post.city} · {post.odometerKm.toLocaleString("en-IN")} km
                    </p>
                  </Link>
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
                <p>No notes match these filters.</p>
                <button className="save-button" type="button" onClick={() => { setQuery(""); setSelectedLabel("All"); setMode("latest"); }}>Show all notes</button>
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
                    <progress
                      aria-label={`Owner note detail quality ${selectedPostQuality.score} of ${selectedPostQuality.maxScore}`}
                      className="quality-meter"
                      max={selectedPostQuality.maxScore}
                      value={selectedPostQuality.score}
                    />
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
              <p>Choose a note to read what the owner reported.</p>
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
              <p>Start with a car you are considering. We will show what owners report and what to inspect.</p>
              <button className="primary-action workspace-task-action" type="button" onClick={openShortlistComposer}><Plus aria-hidden="true" />Add a car</button>
            </div>
          )}
        </div>
        <div className="shortlist-grid">
          {shortlistFormOpen ? (
          <form className="composer" id="shortlist-form" onSubmit={addShortlistItem}>
            <h3>Add model to compare</h3>
            <div className="form-row">
              <select aria-label="Car brand" value={shortlistDraft.brand} onChange={(event) => setShortlistDraft({ ...shortlistDraft, brand: event.target.value, model: "" })}>
                {vehicleBrands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                aria-label="Car model"
                list="shortlist-model-suggestions"
                required
                ref={shortlistModelRef}
                value={shortlistDraft.model}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, model: event.target.value })}
                placeholder="Model"
              />
              <datalist id="shortlist-model-suggestions">
                {modelsForBrand(shortlistDraft.brand).map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>
            <div className="form-row">
              <input
                min="0"
                type="number"
                aria-label="Target budget"
                value={shortlistDraft.budget || ""}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, budget: Number(event.target.value) })}
                placeholder="Budget"
              />
              <select
                aria-label="Shortlist status"
                value={shortlistDraft.status}
                onChange={(event) => setShortlistDraft({ ...shortlistDraft, status: event.target.value as ShortlistItem["status"] })}
              >
                {shortlistStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <textarea
              aria-label="Decision notes"
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
                        aria-label={`Status for ${comparison.item.brand} ${comparison.item.model}`}
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
                      aria-label={`Decision notes for ${comparison.item.brand} ${comparison.item.model}`}
                      rows={3}
                      value={comparison.item.notes}
                      onChange={(event) => updateShortlistItem(comparison.item.id, { notes: event.target.value })}
                      placeholder="Decision notes"
                    />
                  </article>
                );
              })
            ) : (
              <div className="empty-state">Add a car to compare price, what owners report, and what to inspect.</div>
            )}
          </div>
          ) : null}
        </div>
      </section>

      {postComposerOpen ? (
      <section className="panel split-panel screen-community" id="write">
        <div>
          <p className="eyebrow">Publish</p>
          <h2>Share what another owner should know.</h2>
          <p>
            Include the exact car, city, mileage, symptoms, costs, and outcome so others can judge whether your note applies
            to them.
          </p>
          <div className={`quality-card ${draftQuality.grade.toLowerCase().replace(/\s+/g, "-")}`}>
            <progress
              aria-label={`Draft detail quality ${draftQuality.score} of ${draftQuality.maxScore}`}
              className="quality-meter"
              max={draftQuality.maxScore}
              value={draftQuality.score}
            />
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
            autoFocus={postComposerOpen}
            required
            ref={postTitleRef}
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Title"
          />
          <div className="form-row">
            <input
              aria-label="Garage name"
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
              placeholder="Your garage name"
            />
            <select aria-label="Note type" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as KnowledgeLabel })}>
              {knowledgeLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <select aria-label="Car brand" value={draft.brand} onChange={(event) => setDraft({ ...draft, brand: event.target.value })}>
              {vehicleBrands.map((brand) => (
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
            aria-label="Odometer in kilometres"
            value={draft.odometerKm || ""}
            onChange={(event) => setDraft({ ...draft, odometerKm: Number(event.target.value) })}
            placeholder="Odometer km"
          />
          <textarea
            aria-label="Owner note details"
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
            <Download aria-hidden="true" />
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
            <div><span className="readout-label">Total spent</span><strong>{currentLedger ? formatMoney(currentLedger.totalSpend) : "No spend yet"}</strong></div>
            <div><span className="readout-label">Service due</span><strong>{currentReminder?.title ?? "Nothing due"}</strong></div>
          </div>
        ) : (
          <div className="empty-state garage-empty-state">
            <p>Add your car to track service dates, repairs, and total spend.</p>
            <button className="primary-action workspace-task-action" type="button" onClick={openVehicleComposer}><Plus aria-hidden="true" />Add my car</button>
          </div>
        )}
        {garageForm ? (
        <div className="garage-grid">
          {garageForm === "vehicle" ? (
          <form className="composer" id="vehicle-form" onSubmit={addVehicle}>
            <h3>Add vehicle</h3>
            <input
              aria-label="Vehicle nickname"
              ref={vehicleNicknameRef}
              value={vehicleDraft.nickname}
              onChange={(event) => setVehicleDraft({ ...vehicleDraft, nickname: event.target.value })}
              placeholder="Nickname"
            />
            <div className="form-row">
              <select aria-label="Vehicle brand" value={vehicleDraft.brand} onChange={(event) => setVehicleDraft({ ...vehicleDraft, brand: event.target.value, model: "" })}>
                {vehicleBrands.map((brand) => (
                  <option key={brand}>{brand}</option>
                ))}
              </select>
              <input
                aria-label="Vehicle model"
                list="vehicle-model-suggestions"
                required
                value={vehicleDraft.model}
                onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })}
                placeholder="Model"
              />
              <datalist id="vehicle-model-suggestions">
                {modelsForBrand(vehicleDraft.brand).map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
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
                aria-label="Current odometer"
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
            <h3>{timelineDraft.kind === "Insurance" ? "Log insurance details" : "Add service or cost record"}</h3>
            <select
              aria-label="Vehicle"
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
                aria-label="Record type"
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
                aria-label="Amount paid"
                value={timelineDraft.amount || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, amount: Number(event.target.value) })}
                placeholder="Amount paid"
              />
              <input
                min="0"
                type="number"
                aria-label="Record odometer"
                value={timelineDraft.odometerKm || ""}
                onChange={(event) => setTimelineDraft({ ...timelineDraft, odometerKm: Number(event.target.value) })}
                placeholder="Odometer"
              />
            </div>
            <textarea
              aria-label="Service record details"
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
            <div className="empty-state">No upcoming reminders. Add a service or insurance record to keep this current.</div>
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
        <a className={activeNav === "home" ? "is-active" : ""} href="/" aria-current={activeNav === "home" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("home", "home"); }}>
          <House className="shell-icon" aria-hidden="true" />
          <span>Today</span>
        </a>
        <a className={activeNav === "shortlist" ? "is-active" : ""} href="/shortlist" aria-current={activeNav === "shortlist" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("shortlist"); }}>
          <ListChecks className="shell-icon" aria-hidden="true" />
          <span>Shortlist</span>
          {shortlist.length ? <strong>{shortlist.length}</strong> : null}
        </a>
        <a className={activeNav === "garage" ? "is-active" : ""} href="/garage" aria-current={activeNav === "garage" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("garage"); }}>
          <CarFront className="shell-icon" aria-hidden="true" />
          <span>Garage</span>
          {garage.length ? <strong>{garage.length}</strong> : null}
        </a>
        <a className={activeNav === "community" ? "is-active" : ""} href="/community" aria-current={activeNav === "community" ? "page" : undefined} onClick={(event) => { event.preventDefault(); openWorkspace("community", "community", "latest"); }}>
          <MessageCircle className="shell-icon" aria-hidden="true" />
          <span>Community</span>
        </a>
      </nav>

    </main>
    </>
  );
}
