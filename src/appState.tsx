import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { getSupabaseClient, isCloudSyncConfigured } from "./supabase";

export type FeedMode = "latest" | "helpful" | "saved" | "following";

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

export const garageRoles: Profile["garageRole"][] = ["Owner", "Buyer", "Enthusiast", "Mechanic"];

const getInitialOnlineStatus = (): boolean => {
  try {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  } catch {
    return true;
  }
};

export function useAutoflexState() {
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

  const handleVehicleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
    home: { eyebrow: "Cockpit", title: "Today", detail: "Your car's next task." },
    shortlist: { eyebrow: "Choosing a car", title: "Shortlist", detail: `${shortlist.length} car${shortlist.length === 1 ? "" : "s"} saved to compare.` },
    garage: { eyebrow: "My cars", title: "Garage", detail: currentVehicle ? "Service, costs, and records." : "Add a car to get started." },
    community: { eyebrow: "From owners", title: "Community", detail: `${filteredPosts.length} matching note${filteredPosts.length === 1 ? "" : "s"}.` },
    kyv: { eyebrow: "Know your vehicle", title: "KYV", detail: "Compliance, specs, and health telemetry." },
    vault: { eyebrow: "Documents", title: "Vault", detail: "Registration, insurance, and licenses." },
    analytics: { eyebrow: "System telemetry", title: "Analytics", detail: "Usage and performance signals." },
    creators: { eyebrow: "Creator network", title: "Creator Connect", detail: "Builders, reviewers, and track specialists." },
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

  return {
    // data state
    posts,
    profile,
    reports,
    shortlist,
    saved,
    follows,
    subscriptionSettings,
    garage,
    timeline,
    // ui state
    query,
    setQuery,
    mode,
    setMode,
    selectedLabel,
    setSelectedLabel,
    selectedPost,
    setSelectedPost,
    postDetailOpen,
    draft,
    setDraft,
    vehicleDraft,
    setVehicleDraft,
    timelineDraft,
    setTimelineDraft,
    shortlistDraft,
    setShortlistDraft,
    commentDraft,
    setCommentDraft,
    reportDraft,
    setReportDraft,
    actionMessage,
    setActionMessage,
    accountView,
    vehicleMenuOpen,
    setVehicleMenuOpen,
    shortlistFormOpen,
    setShortlistFormOpen,
    garageForm,
    setGarageForm,
    confirmClearData,
    setConfirmClearData,
    postComposerOpen,
    activeNav,
    activeScreen,
    isOnline,
    cloudEmail,
    setCloudEmail,
    cloudUser,
    cloudBackupUpdatedAt,
    cloudBusy,
    // refs
    communitySearchRef,
    postTitleRef,
    shortlistModelRef,
    timelineTitleRef,
    vehicleNicknameRef,
    postDetailHeadingRef,
    shortlistHeadingRef,
    garageHeadingRef,
    profileNameRef,
    settingsHeadingRef,
    restoreBackupRef,
    clearDataTriggerRef,
    clearDataCancelRef,
    notificationsFirstRef,
    accountHeaderRef,
    vehicleMenuRef,
    vehicleTriggerRef,
    // derived data
    notebooks,
    followedModelSet,
    followedTopicSet,
    filteredPosts,
    connectionStatus,
    notificationPreview,
    garageCostLedger,
    garageReminders,
    cityCircles,
    moderationSummary,
    shortlistComparisons,
    shortlistDecisionLanes,
    inspectionChecklistByItemId,
    draftQuality,
    selectedPostQuality,
    stats,
    currentVehicle,
    currentReminder,
    currentLedger,
    isFirstRun,
    workspaceCopy,
    accountBackLabel,
    // persistence helpers
    persistProfile,
    persistSubscriptionSettings,
    // actions
    toggleSaved,
    toggleFollowModel,
    toggleFollowTopic,
    markHelpful,
    confirmFix,
    addComment,
    reportSelectedPost,
    setReportStatus,
    removeReportedPost,
    shareSelectedPost,
    shareModelNotebook,
    exportGarage,
    downloadBackup,
    restoreBackup,
    clearAllData,
    requestCloudSignIn,
    uploadCloudBackup,
    restoreCloudData,
    disconnectCloud,
    addShortlistItem,
    addSelectedToShortlist,
    updateShortlistItem,
    removeShortlistItem,
    publishPost,
    addVehicle,
    addTimelineNote,
    openWorkspace,
    openProfile,
    openAccountView,
    returnFromAccount,
    selectVehicle,
    openVehicleMenu,
    handleVehicleMenuKeyDown,
    openPostDetail,
    openPostComposer,
    openShortlistComposer,
    openVehicleComposer,
    openGarageRecordComposer,
    openInsuranceRecordComposer,
    returnToCommunityFeed,
  };
}

export type AutoflexApp = ReturnType<typeof useAutoflexState>;

const AppStateContext = createContext<AutoflexApp | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const value = useAutoflexState();
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp(): AutoflexApp {
  const value = useContext(AppStateContext);
  if (!value) throw new Error("useApp must be used inside <AppStateProvider>");
  return value;
}
