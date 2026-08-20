import {
  createContext,
  useCallback,
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
  addHostedComment,
  checklistToSession,
  inspectionSessionIdFor,
  listHostedCityCircles,
  listHostedCityFollows,
  listHostedCosts,
  listHostedInspections,
  listHostedNotificationJobs,
  listHostedPlaybookEntries,
  listHostedPlaybooks,
  listHostedPostQuality,
  listHostedPosts,
  listHostedReminders,
  mergePostCollections,
  publishHostedChecklists,
  publishHostedCityCircles,
  publishHostedPostQuality,
  saveHostedFollows,
  saveHostedProfile,
  saveHostedSubscriptionSettings,
  setHostedSavedPost,
  syncAllHosted,
  syncHostedCostsFromTimeline,
  upsertHostedPlaybooks,
  upsertHostedPost,
  upsertHostedPosts,
  upsertHostedReminders,
  upsertHostedReport,
  upsertHostedReports,
  upsertHostedShortlistItems,
  upsertHostedTimelineEntries,
  upsertHostedVehicles,
  type HostedCityCircle,
  type HostedGarageCost,
  type HostedGarageReminder,
  type HostedInspectionSession,
  type HostedNotificationJob,
  type HostedPlaybookEntry,
  type HostedPostQuality,
  type HostedResult,
  type HostedSyncOutcome,
} from "../../infrastructure/hosted";
import { shareContent, shareResultMessage, citySlugFor, type ShareContent } from "../sharing/share";
import { loadCloudBackup, saveCloudBackup, sendCloudSignInLink, signOutCloud } from "../../infrastructure/cloud/cloudSync";
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
} from "../../core/entities";
import { assessPostQuality, groupByModel, modelKeyFor, slugifyCity, type CityCircle, type OwnershipPlaybook } from "../../core/index";
import { buildConnectionStatusCopy } from "../../features/account/index";
import { buildInspectionChecklists, buildShortlistComparisons, buildShortlistDecisionLanes } from "../../features/buying/index";
import { buildModerationSummary, buildNotificationPreview, filterPostsByMode } from "../../features/community/index";
import { buildCityCircles, buildOwnershipPlaybooks } from "../../features/content/index";
import { buildGarageCostLedger, buildGarageExportMarkdown, buildGarageReminders, buildTimelineAnalytics } from "../../features/garage/index";
import {
  buildAutoflexBackup,
  clearAutoflexData,
  loadCityFollows,
  loadLocalUpdatedAt,
  markLocalUpdated,
  readCloudOwner,
  saveCloudOwner,
  saveCityFollows,
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
  saveFeedback,
  saveFollows,
  saveGarage,
  savePosts,
  saveProfile,
  saveReports,
  saveSaved,
  saveShortlist,
  saveSubscriptionSettings,
  saveTimeline,
} from "../../infrastructure/storage/localStore";
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
} from "../routing/routes";
import { getSupabaseClient, isCloudSyncConfigured } from "../../infrastructure/supabase/client";
import { readCloudUser, type CloudUser } from "../../infrastructure/supabase/auth";
import { initialPostDraft } from "../../features/community";
import { initialTimelineDraft, initialVehicleDraft } from "../../features/garage";
import { initialShortlistDraft } from "../../features/buying";
import { useConnectionStatus } from "../../features/account";
import { useCommunityDerived, type FeedMode } from "../../features/community";
import { useGarageDerived } from "../../features/garage";
import { useContentDerived } from "../../features/content";
import { useBuyingDerived } from "../../features/buying";

/** Re-exported from the community feature so screens keep one import site. */
export type { FeedMode };

/** Re-exported so screens keep importing the app-facing name from one place. */
export type { CloudUser };

/**
 * `unconfigured`, `signed-out` and `offline` are ordinary states, not errors.
 * Only a real request failure produces user-facing copy.
 */
const hostedProblemMessage = <Data,>(result: HostedResult<Data>): string =>
  result.ok || (result.reason !== "request-failed" && result.reason !== "unexpected") ? "" : result.message;

export const garageRoles: Profile["garageRole"][] = ["Owner", "Buyer", "Enthusiast", "Mechanic"];
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
  const [draft, setDraft] = useState<DraftPost>(initialPostDraft);
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
  const { connectionStatus, isOnline } = useConnectionStatus();
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);

  const [cloudBackupUpdatedAt, setCloudBackupUpdatedAt] = useState<string | null>(null);
  const [cloudReadyToSync, setCloudReadyToSync] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  // Hosted mirrors. Every one of these starts empty and stays empty offline or
  // signed-out, so first paint never waits on the network.
  const [hostedQuality, setHostedQuality] = useState<HostedPostQuality[]>([]);
  const [hostedCities, setHostedCities] = useState<HostedCityCircle[]>([]);
  const [hostedPlaybooks, setHostedPlaybooks] = useState<OwnershipPlaybook[]>([]);
  const [hostedPlaybookEntries, setHostedPlaybookEntries] = useState<HostedPlaybookEntry[]>([]);
  const [hostedInspections, setHostedInspections] = useState<HostedInspectionSession[]>([]);
  const [hostedReminders, setHostedReminders] = useState<HostedGarageReminder[]>([]);
  const [hostedCosts, setHostedCosts] = useState<HostedGarageCost[]>([]);
  const [notificationJobs, setNotificationJobs] = useState<HostedNotificationJob[]>([]);
  const [cityFollows, setCityFollows] = useState<Set<string>>(() => loadCityFollows());
  const [hostedSyncing, setHostedSyncing] = useState(false);
  const localUpdatedAtRef = useRef<string>(loadLocalUpdatedAt());
  const cloudUserRef = useRef<CloudUser | null>(null);
  const cloudOwnerRef = useRef<string | null>(readCloudOwner());

  /** Records which account this device's data belongs to. */
  const writeCloudOwner = (userId: string | null): void => {
    cloudOwnerRef.current = userId;
    saveCloudOwner(userId);
  };
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

  /* ------------------------------------------------------------------ */
  /* Derived state, owned by the feature that owns the concept.          */
  /*                                                                     */
  /* Each hook takes the state it reads as an explicit argument, so the  */
  /* composition root stays the only owner of `useState` and a feature   */
  /* can be exercised without mounting the provider.                     */
  /* ------------------------------------------------------------------ */
  const {
    draftQuality,
    feedRankingSource,
    filteredPosts,
    followedModelSet,
    followedTopicSet,
    hostedQualityByPostId,
    moderationSummary,
    notebooks,
    notificationPreview,
    selectedPostQuality,
  } = useCommunityDerived({
    draft,
    follows,
    hostedQuality,
    mode,
    posts,
    query,
    reports,
    saved,
    selectedLabel,
    selectedPost,
    subscriptionSettings,
  });

  const {
    garageCostLedger,
    garageReminders,
    hostedCostByVehicleId,
    localReminders,
    reminderStatusById,
    timelineAnalytics,
    vehicleProfileById,
  } = useGarageDerived({ garage, hostedCosts, hostedReminders, timeline });

  const { cityCircles, hostedCityBySlug, ownershipPlaybooks } = useContentDerived({
    garage,
    hostedCities,
    hostedPlaybooks,
    posts,
  });

  const {
    inspectionChecklistByItemId,
    inspectionChecklists,
    inspectionSessionByItemId,
    shortlistComparisons,
    shortlistDecisionLanes,
  } = useBuyingDerived({ hostedInspections, posts, shortlist });

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

  /* ---------------------------------------------------------------------- */
  /* Hosted orchestration                                                     */
  /*                                                                          */
  /* Nothing below blocks first paint: local state is already rendered from    */
  /* localStorage by the time any of these effects run, and every hosted call  */
  /* returns usable `data` on both arms instead of throwing.                   */
  /* ---------------------------------------------------------------------- */

  /** Applies a merged hosted workspace to both React state and localStorage. */
  const applyHostedWorkspace = (workspace: HostedSyncOutcome["workspace"]) => {
    const savedSet = new Set(workspace.saved);
    setPosts(workspace.posts);
    savePosts(workspace.posts);
    setProfile(workspace.profile);
    saveProfile(workspace.profile);
    setReports(workspace.reports);
    saveReports(workspace.reports);
    setShortlist(workspace.shortlist);
    saveShortlist(workspace.shortlist);
    setSaved(savedSet);
    saveSaved(savedSet);
    setFollows(workspace.follows);
    saveFollows(workspace.follows);
    setSubscriptionSettings(workspace.subscriptionSettings);
    saveSubscriptionSettings(workspace.subscriptionSettings);
    setGarage(workspace.garage);
    saveGarage(workspace.garage);
    setTimeline(workspace.timeline);
    saveTimeline(workspace.timeline);
    saveFeedback(workspace.feedback);
  };

  const refreshHostedForUser = async (userId: string, vehicles = loadGarage()) => {
    const [inspections, reminders, costs, jobs, followedCities] = await Promise.all([
      listHostedInspections(userId, []),
      listHostedReminders(userId, vehicles, []),
      listHostedCosts(userId, []),
      listHostedNotificationJobs(userId, []),
      listHostedCityFollows(userId, []),
    ]);
    setHostedInspections(inspections.data);
    setHostedReminders(reminders.data);
    setHostedCosts(costs.data);
    setNotificationJobs(jobs.data);
    if (followedCities.ok) {
      const slugs = new Set(followedCities.data.map((follow) => follow.citySlug).filter(Boolean));
      setCityFollows(slugs);
      saveCityFollows(slugs);
    }
  };

  /**
   * Whole-workspace merge. Runs on sign-in and from the manual "Sync now"
   * action. The local snapshot is always kept when hosted is unreachable, and
   * only a genuine request failure produces user-facing copy.
   */
  const runHostedSync = async (
    userId: string | null | undefined,
    options: { announce?: boolean } = {},
  ): Promise<HostedResult<HostedSyncOutcome> | null> => {
    if (!userId) return null;
    setHostedSyncing(true);
    try {
      const result = await syncAllHosted(userId, buildAutoflexBackup().data, {
        localUpdatedAt: localUpdatedAtRef.current || null,
      });
      applyHostedWorkspace(result.data.workspace);
      if (result.data.syncedAt) {
        setCloudBackupUpdatedAt(result.data.syncedAt);
        // After a merge the two copies agree, so the write clock moves to the
        // sync point. Without this, hosted could never win a later round.
        localUpdatedAtRef.current = markLocalUpdated(result.data.syncedAt);
      }
      const problem = hostedProblemMessage(result);
      if (problem) setActionMessage(problem);
      else if (options.announce) {
        setActionMessage(
          result.ok ? "Your Autoflex data is in sync." : "Saved on this device. It will sync when you are back online.",
        );
      }
      return result;
    } finally {
      setHostedSyncing(false);
    }
  };

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;

    void readCloudUser().then((user) => {
      if (active) setCloudUser(user);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      window.setTimeout(() => {
        if (!active) return;
        setCloudUser(user ? { email: user.email ?? "Signed-in user", id: user.id } : null);
        if (!user) {
          setCloudBackupUpdatedAt(null);
          setHostedInspections([]);
          setHostedReminders([]);
          setHostedCosts([]);
          setNotificationJobs([]);
        }
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Anon-readable surfaces: these work signed-out, so the feed, rankings, city
  // pages and playbooks are populated for a first-time visitor too.
  useEffect(() => {
    if (!isCloudSyncConfigured) return;
    let active = true;

    void listHostedPosts([]).then((result) => {
      if (!active || !result.data.length) return;
      setPosts((current) => {
        const merged = mergePostCollections(current, result.data);
        // A pull is not a local write: the last-local-write clock stays put.
        savePosts(merged);
        return merged;
      });
    });
    void listHostedPostQuality([]).then((result) => {
      if (active) setHostedQuality(result.data);
    });
    void listHostedCityCircles([]).then((result) => {
      if (active) setHostedCities(result.data);
    });
    void listHostedPlaybooks([]).then((result) => {
      if (active) setHostedPlaybooks(result.data);
    });
    void listHostedPlaybookEntries(undefined, []).then((result) => {
      if (active) setHostedPlaybookEntries(result.data);
    });

    return () => {
      active = false;
    };
  }, []);

  // Sign-in: merge the whole workspace, then pull the per-user side tables.
  useEffect(() => {
    const userId = cloudUser?.id;
    if (!userId) return;
    let active = true;
    void runHostedSync(userId).then(() => {
      if (active) void refreshHostedForUser(userId);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudUser?.id]);

  // Derived surfaces stay local-first and are published explicitly, debounced so
  // a burst of edits results in one idempotent write per surface.
  useEffect(() => {
    const userId = cloudUser?.id;
    if (!userId) return;
    const timeout = window.setTimeout(() => {
      void publishHostedCityCircles(userId, cityCircles);
      void upsertHostedPlaybooks(userId, ownershipPlaybooks);
      void publishHostedChecklists(userId, inspectionChecklists);
      void upsertHostedReminders(userId, localReminders);
      void syncHostedCostsFromTimeline(userId, timeline);
      void publishHostedPostQuality(userId, posts).then((result) => {
        if (!result.ok) return;
        setHostedQuality((current) => {
          const merged = new Map(current.map((quality) => [quality.postId, quality]));
          result.data.forEach((quality) => merged.set(quality.postId, quality));
          return [...merged.values()];
        });
      });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [cityCircles, cloudUser?.id, inspectionChecklists, localReminders, ownershipPlaybooks, posts, timeline]);

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
      // `/cars/:slug`, `/playbooks/:slug` and `/cities/:slug` used to set only the
      // document title: the slug was parsed, stored, and never read, so a shared
      // link landed on the bare parent workspace and contradicted the Open Graph
      // card that advertised it. Resolve each slug onto the surface that answers it.
      const detailPost =
        routedPost ??
        (route.detailSlug && (route.detailType === "car" || route.detailType === "playbook")
          ? posts.find((post) => modelKeyFor(post.brand, post.model) === route.detailSlug)
          : undefined);
      if (detailPost) {
        setSelectedPost(detailPost);
        setPostDetailOpen(true);
      } else {
        setPostDetailOpen(false);
      }
      if (route.detailType === "city" && route.detailSlug) {
        const routedCity = posts.find((post) => slugifyCity(post.city) === route.detailSlug)?.city;
        // Fall back to the de-slugged label so an empty circle still reads as itself.
        setQuery(routedCity ?? route.detailSlug.replace(/-/g, " "));
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

  /**
   * Stamps a local mutation and mirrors it to the hosted tables.
   *
   * State and localStorage are written first and unconditionally, so behaviour
   * is identical with no network, no session, or no Supabase configuration.
   * The hosted push is fire-and-forget and cannot throw.
   */
  const noteLocalWrite = (push?: (userId: string) => void): void => {
    localUpdatedAtRef.current = markLocalUpdated();
    const userId = cloudUserRef.current?.id;
    if (userId && push) push(userId);
  };

  const persistPosts = (nextPosts: OwnerPost[]) => {
    setPosts(nextPosts);
    savePosts(nextPosts);
    noteLocalWrite((userId) => void upsertHostedPosts(userId, nextPosts));
  };

  const persistFollows = (nextFollows: FollowState) => {
    setFollows(nextFollows);
    saveFollows(nextFollows);
    noteLocalWrite((userId) => void saveHostedFollows(userId, nextFollows));
  };

  const persistSubscriptionSettings = (nextSettings: SubscriptionSettings) => {
    setSubscriptionSettings(nextSettings);
    saveSubscriptionSettings(nextSettings);
    noteLocalWrite((userId) => void saveHostedSubscriptionSettings(userId, nextSettings));
  };

  const persistProfile = (nextProfile: Profile) => {
    setProfile(nextProfile);
    saveProfile(nextProfile);
    noteLocalWrite((userId) => void saveHostedProfile(userId, nextProfile));
  };

  const persistReports = (nextReports: ReportRecord[]) => {
    setReports(nextReports);
    saveReports(nextReports);
    noteLocalWrite((userId) => void upsertHostedReports(userId, nextReports));
  };

  const persistShortlist = (nextShortlist: ShortlistItem[]) => {
    setShortlist(nextShortlist);
    saveShortlist(nextShortlist);
    noteLocalWrite((userId) => void upsertHostedShortlistItems(userId, nextShortlist));
  };

  const persistGarage = (nextGarage: GarageVehicle[]) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    noteLocalWrite((userId) => void upsertHostedVehicles(userId, nextGarage));
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const persistTimeline = (nextTimeline: TimelineEntry[]) => {
    setTimeline(nextTimeline);
    saveTimeline(nextTimeline);
    noteLocalWrite((userId) => {
      void upsertHostedTimelineEntries(userId, nextTimeline);
      void syncHostedCostsFromTimeline(userId, nextTimeline);
    });
  };

  /**
   * Wrapped in `useCallback` so memoised list rows can skip re-rendering.
   * The dependency is the data it actually reads, not the whole render — a
   * keystroke in the composer no longer changes this function's identity.
   */
  const toggleSaved = useCallback((postId: string) => {
    const next = new Set(saved);
    const wasSaved = next.has(postId);
    if (wasSaved) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
    setActionMessage(wasSaved ? "Removed from saved notes." : "Note saved.");
    noteLocalWrite((userId) => void setHostedSavedPost(userId, postId, !wasSaved));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- persist helpers are recreated each render by design
  }, [saved]);

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

  const markHelpful = useCallback((postId: string) => {
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: post.helpful + 1 } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- persist helpers are recreated each render by design
  }, [posts]);

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
    const comment = commentDraft.trim();
    const postId = selectedPost.id;
    noteLocalWrite((userId) => void addHostedComment(userId, postId, author, comment));
    setActionMessage(cloudUser ? "Comment posted." : "Comment saved on this device. Sign in to share it with Community.");
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
    noteLocalWrite((userId) => void upsertHostedReport(userId, report));
    setActionMessage(
      cloudUser ? "Report sent to moderators." : "Report saved on this device. Sign in to send it to moderators.",
    );
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

  /** Share via the deep-link aware ladder: Web Share, clipboard, then manual. */
  const share = async (content: ShareContent): Promise<void> => {
    setActionMessage(shareResultMessage(await shareContent(content)));
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
    void share({ kind: "post", post: selectedPost });
  };

  const shareModelNotebook = (brand: string, model: string) => {
    const key = modelKeyFor(brand, model);
    const notebook = notebooks.find((item) => item.key === key);
    if (!notebook) return;
    const playbook = ownershipPlaybooks.find((item) => item.key === key);
    void share({
      kind: "playbook",
      playbook: {
        brand,
        model,
        confidence: playbook?.confidence ?? "Early signal",
        evidenceCount: playbook?.evidenceCount ?? notebook.posts.length,
        headline: playbook?.headline ?? `${brand} ${model} owner notes`,
      },
    });
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
    noteLocalWrite((userId) => {
      void upsertHostedPost(userId, post);
      void publishHostedPostQuality(userId, [post]);
    });
    setSelectedPost(post);
    setPostDetailOpen(true);
    setPostComposerOpen(false);
    setDraft(initialPostDraft);
    setActionMessage(cloudUser ? "Owner note published." : "Note saved on this device. Sign in to publish it to Community.");
    window.requestAnimationFrame(() => postDetailHeadingRef.current?.focus());
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      variant: vehicleDraft.variant.trim(),
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

  const openPostDetail = useCallback((post: OwnerPost) => {
    setSelectedPost(post);
    setPostDetailOpen(true);
    updateRoute(`/community/${encodeURIComponent(post.id)}`);
    window.requestAnimationFrame(() => {
      document.querySelector(".detail-card")?.scrollIntoView({ block: "start" });
      postDetailHeadingRef.current?.focus({ preventScroll: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- updateRoute is recreated each render by design
  }, []);

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
    home: { eyebrow: "Cockpit", title: "Today", detail: "Vehicle snapshot, next task, and new owner notes." },
    community: { eyebrow: "From owners", title: "Community", detail: `${filteredPosts.length} matching note${filteredPosts.length === 1 ? "" : "s"} from owners.` },
    garage: {
      eyebrow: "My cars",
      title: "Garage",
      detail: currentVehicle ? "Service history, running costs, and vehicle records." : "Add a car to track service, costs, and records.",
    },
    shortlist: { eyebrow: "Choosing a car", title: "Compare", detail: `${shortlist.length} car${shortlist.length === 1 ? "" : "s"} saved to compare.` },
    kyv: { eyebrow: "Know your vehicle", title: "KYV", detail: "Registration, compliance, and hardware specs." },
    vault: { eyebrow: "Documents", title: "Vault", detail: "Registration, insurance, and licence records." },
    analytics: { eyebrow: "System telemetry", title: "Analytics", detail: "Usage and performance signals on this device." },
    creators: { eyebrow: "Creator network", title: "Creators", detail: "Builders, reviewers, and track specialists." },
    account:
      accountView === "profile"
        ? { eyebrow: "Account", title: "Profile", detail: "Your name, city, and role." }
        : accountView === "saved"
          ? { eyebrow: "Account", title: "Saved notes", detail: "Owner notes you saved for later." }
          : accountView === "following"
            ? { eyebrow: "Account", title: "Following", detail: "Cars and topics you follow." }
            : accountView === "notifications"
              ? { eyebrow: "Account", title: "Notifications", detail: "Updates you want to receive." }
              : { eyebrow: "Account", title: "Settings", detail: "Data, privacy, and preferences." },
  };
  const accountBackLabel =
    accountView !== "profile"
      ? "Back to Profile"
      : `Back to ${accountReturnScreenRef.current === "home" ? "Today" : accountReturnScreenRef.current === "shortlist" ? "Compare" : accountReturnScreenRef.current === "garage" ? "Garage" : "Community"}`;

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
