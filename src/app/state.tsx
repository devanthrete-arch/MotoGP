// All state and behaviour of the signed-in app, as one hook. Views read it through useOtofolks().
// It is one hook because the features still share state; split it per feature as each is rebuilt.
import { FormEvent, MouseEvent, useEffect, useMemo, useState, createContext, useContext } from "react";
import {
  deleteCommunityPost, isSharedPost, loadCommunityComments, loadCommunityPosts, loadMyCommunityPostIds,
  publishCommunityComment, publishCommunityPost, reportCommunityPost,
} from "../communityCloud";
import { toastDuration } from "../ui/Toast";
import { buildTopPitStopReels, filterPitStopClipsByCategory, pitStopClips, type PitStopClip } from "../pitstop";
import {
  privacyReadinessItems, starterRoutes, type DraftPost, type DraftShortlistItem, type DraftTimelineEntry,
  type DraftVehicle, type FollowState, type GarageVehicle, type KnowledgeLabel, type OwnerPost,
  type Profile, type ReportRecord, type ShortlistItem, type SubscriptionSettings, type TimelineEntry,
} from "../domain";
import {
  assessPostQuality, buildCityCircles, buildConnectionStatusCopy, buildGarageCostLedger,
  buildGarageInsights, buildGarageExportMarkdown, buildGarageReminders, buildInspectionChecklists,
  buildModelSharePayload, buildModerationSummary, buildNotificationPreview, buildOwnershipPlaybooks,
  buildPostSharePayload, buildPrivacyReadinessSummary, buildReturnNudges, buildShortlistComparisons,
  buildStarterRouteProgress, filterPostsByMode, groupByModel, modelKeyFor,
} from "../insights";
import {
  createReport, createShortlistItem, createTimelineEntry, createVehicle, loadFollows, loadGarage,
  loadProfile, loadPosts, loadReports, loadSaved, loadShortlist, loadSubscriptionSettings, loadTimeline,
  saveFollows, saveGarage, savePosts, saveProfile, saveReports, saveSaved, saveShortlist,
  saveSubscriptionSettings, saveTimeline, setStorageUser, readStoredJson, writeStoredJson,
} from "../storage";
import {
  type AppAuthState, type AppProps, type AppView, type ComparisonSection, type FeedMode, type PriceState,
  buildCompareVerdict, compareMetricSections, comparisonSectionTitles, defaultPriceState,
  firstVariantForModel, getInitialOnlineStatus, initialDraft, initialShortlistDraft, initialTimelineDraft,
  initialVehicleDraft, modelDetailsFor, pitStopCategoryFromHash, priceForModel, priceSourceFor,
  stateForCity, viewFromHash,
} from "./model";

export function useOtofolksState({ auth, clerkEnabled = false }: AppProps & { auth: AppAuthState }) {
  setStorageUser(auth.isSignedIn ? auth.userId ?? null : null);
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [sharedPosts, setSharedPosts] = useState<OwnerPost[]>([]);
  const [communityStatus, setCommunityStatus] = useState("Loading shared notes...");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityRefresh, setCommunityRefresh] = useState(0);
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
  const [selectedFeedState, setSelectedFeedState] = useState<PriceState | "All">("All");
  const initialPitStopCollection = pitStopCategoryFromHash();
  const [selectedPitStopCategory, setSelectedPitStopCategory] = useState<PitStopClip["category"] | "All">(
    initialPitStopCollection ?? "All",
  );
  const [selectedPitStopCollection, setSelectedPitStopCollection] = useState<PitStopClip["category"] | null>(initialPitStopCollection);
  const [activeReel, setActiveReel] = useState<PitStopClip | null>(null);
  const [selectedPost, setSelectedPost] = useState<OwnerPost | null>(posts[0] ?? null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<DraftPost>(initialDraft);
  const [vehicleDraft, setVehicleDraft] = useState<DraftVehicle>(initialVehicleDraft);
  const [timelineDraft, setTimelineDraft] = useState<DraftTimelineEntry>(() => ({
    ...initialTimelineDraft,
    vehicleId: loadGarage()[0]?.id ?? "",
  }));
  const [shortlistDraft, setShortlistDraft] = useState<DraftShortlistItem>(initialShortlistDraft);
  const [dealerQuote, setDealerQuote] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [reportDraft, setReportDraft] = useState("");
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const setActionMessage = (text: string) => setToast(text ? { id: Date.now(), text } : null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toastDuration(toast.text));
    return () => window.clearTimeout(timer);
  }, [toast]);
  // null until the server has answered the ownership call, which only exists once the feed
  // hardening migration is applied. Until then no delete action is offered.
  const [myPostIds, setMyPostIds] = useState<ReadonlySet<string> | null>(null);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [helpfulIds, setHelpfulIds] = useState<string[]>(() => readStoredJson("otofolks.helpful.v1", []));
  const [confirmedIds, setConfirmedIds] = useState<string[]>(() => readStoredJson("otofolks.confirmed.v1", []));
  const [activeView, setActiveView] = useState<AppView>(viewFromHash);
  useEffect(() => {
    const syncView = () => {
      setActiveView(viewFromHash());
      setNavMenuOpen(false);
      setActiveReel(null);
      setComposerOpen(false);
      window.scrollTo({ top: 0 });
    };
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavMenuOpen(false);
        setActiveReel(null);
        document.querySelector<HTMLButtonElement>(".nav-toggle")?.focus();
      }
    };
    window.addEventListener("hashchange", syncView);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("hashchange", syncView);
      window.removeEventListener("keydown", closeMenu);
    };
  }, []);
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const feedPosts = useMemo(() => [...sharedPosts, ...posts], [sharedPosts, posts]);

  useEffect(() => {
    if (!auth.isSignedIn) { setSharedPosts([]); return; }
    if (!auth.cloudClient || !auth.cloudToken) {
      setCommunityStatus("Shared community is not configured. Local examples remain available.");
      return;
    }
    if (!isOnline) { setCommunityStatus("Offline. Shared notes cannot refresh right now."); return; }
    let active = true;
    loadCommunityPosts(auth.cloudClient, auth.cloudToken).then(next => {
      if (active) { setSharedPosts(next); setCommunityStatus(""); }
    }).catch(error => {
      if (active) setCommunityStatus(error instanceof Error ? error.message : "Shared notes could not load.");
    });
    return () => { active = false; };
  }, [auth.cloudClient, auth.cloudToken, auth.isSignedIn, communityRefresh, isOnline]);

  useEffect(() => {
    if (!auth.isSignedIn || !auth.cloudClient || !auth.cloudToken || !isOnline) { setMyPostIds(null); return; }
    let active = true;
    loadMyCommunityPostIds(auth.cloudClient, auth.cloudToken).then(ids => {
      if (active) setMyPostIds(new Set(ids));
    }).catch(() => {
      if (active) setMyPostIds(null);
    });
    return () => { active = false; };
  }, [auth.cloudClient, auth.cloudToken, auth.isSignedIn, communityRefresh, isOnline]);

  useEffect(() => {
    if (!auth.isSignedIn || !auth.cloudClient || !auth.cloudToken || !selectedPost || !isSharedPost(selectedPost.id) || !isOnline) return;
    const id = selectedPost.id;
    let active = true;
    loadCommunityComments(auth.cloudClient, auth.cloudToken, id).then(comments => {
      if (active) setSharedPosts(current => current.map(post => post.id === id ? { ...post, comments } : post));
    }).catch(() => {
      if (active) setCommunityStatus("Comments could not load. Please retry when connected.");
    });
    return () => { active = false; };
  }, [auth.cloudClient, auth.cloudToken, auth.isSignedIn, isOnline, selectedPost?.id]);

  const notebooks = useMemo(() => groupByModel(posts), [posts]);
  const followedModelSet = useMemo(() => new Set(follows.models), [follows.models]);
  const followedTopicSet = useMemo(() => new Set(follows.topics), [follows.topics]);

  const filteredPosts = useMemo(() => {
    const modeFilteredPosts = filterPostsByMode(feedPosts, {
        followedModelSet,
        followedTopicSet,
        mode,
        query,
        saved,
        selectedLabel,
      });
    return selectedFeedState === "All"
      ? modeFilteredPosts
      : modeFilteredPosts.filter((post) => stateForCity(post.city) === selectedFeedState);
  }, [feedPosts, followedModelSet, followedTopicSet, mode, query, saved, selectedFeedState, selectedLabel]);
  useEffect(() => {
    const next = filteredPosts.find(post => post.id === selectedPost?.id) ?? filteredPosts[0] ?? null;
    if (next !== selectedPost) setSelectedPost(next);
  }, [filteredPosts, selectedPost]);
  useEffect(() => { setCommentDraft(""); setReportDraft(""); }, [selectedPost?.id]);
  useEffect(() => { setDealerQuote(0); }, [shortlistDraft.brand, shortlistDraft.model, shortlistDraft.variant, shortlistDraft.state]);

  const publishedPitStopClips = useMemo(
    () => pitStopClips.filter((clip) => clip.status === "published"),
    [],
  );
  const pitStopReels = useMemo(() => buildTopPitStopReels(publishedPitStopClips), [publishedPitStopClips]);
  const filteredPitStopClips = useMemo(
    () => filterPitStopClipsByCategory(publishedPitStopClips, selectedPitStopCategory),
    [publishedPitStopClips, selectedPitStopCategory],
  );
  const selectedPitStopReels = useMemo(
    () => pitStopReels.filter((reel) => reel.category === selectedPitStopCollection).slice(0, 50),
    [pitStopReels, selectedPitStopCollection],
  );

  const returnNudges = useMemo(
    () => buildReturnNudges({ followedModelSet, followedTopicSet, garage, posts, savedCount: saved.size }),
    [followedModelSet, followedTopicSet, garage, posts, saved.size],
  );
  const starterProgress = useMemo(
    () =>
      buildStarterRouteProgress({
        follows,
        garage,
        profile,
        routes: starterRoutes,
        savedCount: saved.size,
        shortlistCount: shortlist.length,
      }),
    [follows, garage, profile, saved.size, shortlist.length],
  );
  const completedStarterSteps = starterProgress.filter((step) => step.complete).length;
  const connectionStatus = useMemo(() => buildConnectionStatusCopy(isOnline), [isOnline]);

  const notificationPreview = useMemo(
    () => buildNotificationPreview({ follows, posts, preference: subscriptionSettings }),
    [follows, posts, subscriptionSettings],
  );

  const garageInsights = useMemo(() => buildGarageInsights(garage, timeline, posts), [garage, posts, timeline]);
  const garageCostLedger = useMemo(() => buildGarageCostLedger(garage, timeline), [garage, timeline]);
  const garageReminders = useMemo(() => buildGarageReminders(garage, timeline), [garage, timeline]);
  const cityCircles = useMemo(() => buildCityCircles(posts, garage), [garage, posts]);
  const ownershipPlaybooks = useMemo(() => buildOwnershipPlaybooks(posts), [posts]);
  const moderationSummary = useMemo(() => buildModerationSummary(reports), [reports]);
  const privacySummary = useMemo(() => buildPrivacyReadinessSummary(privacyReadinessItems), []);
  const shortlistComparisons = useMemo(() => buildShortlistComparisons(shortlist, posts), [posts, shortlist]);
  const comparisonSections = useMemo(() => compareMetricSections(shortlistComparisons), [shortlistComparisons]);
  const displayedComparisonSections: ComparisonSection[] = comparisonSections.length
    ? comparisonSections : comparisonSectionTitles.map((title) => ({ title, rows: [] }));
  const compareVerdict = useMemo(() => buildCompareVerdict(shortlistComparisons), [shortlistComparisons]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, posts), [posts, shortlist]);
  const inspectionChecklistByItemId = useMemo(
    () => new Map(inspectionChecklists.map((checklist) => [checklist.item.id, checklist])),
    [inspectionChecklists],
  );
  const draftQuality = useMemo(() => assessPostQuality(draft), [draft]);
  const selectedPostQuality = useMemo(() => (selectedPost ? assessPostQuality(selectedPost) : null), [selectedPost]);
  const shortlistDraftPrice = dealerQuote || priceForModel(
    shortlistDraft.brand,
    shortlistDraft.model,
    shortlistDraft.variant,
    shortlistDraft.state,
    shortlistDraft.status,
  );
  const shortlistDraftSource = dealerQuote ? "Your dealer quote" : priceSourceFor(shortlistDraft.state ?? defaultPriceState, shortlistDraft.status);
  const shortlistDraftDetails = modelDetailsFor(shortlistDraft.brand, shortlistDraft.model);

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
    if (next.has(postId)) next.delete(postId);
    else next.add(postId);
    setSaved(next);
    saveSaved(next);
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
    if (isSharedPost(postId)) return;
    const removing = helpfulIds.includes(postId);
    const ids = removing ? helpfulIds.filter(id => id !== postId) : [...helpfulIds, postId];
    setHelpfulIds(ids);
    writeStoredJson("otofolks.helpful.v1", ids);
    const next = posts.map((post) => (post.id === postId ? { ...post, helpful: Math.max(0, post.helpful + (removing ? -1 : 1)) } : post));
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const confirmFix = (postId: string) => {
    if (isSharedPost(postId)) return;
    const removing = confirmedIds.includes(postId);
    const ids = removing ? confirmedIds.filter(id => id !== postId) : [...confirmedIds, postId];
    setConfirmedIds(ids);
    writeStoredJson("otofolks.confirmed.v1", ids);
    const next = posts.map((post) =>
      post.id === postId ? { ...post, fixesConfirmed: Math.max(0, post.fixesConfirmed + (removing ? -1 : 1)) } : post,
    );
    persistPosts(next);
    setSelectedPost(next.find((post) => post.id === postId) ?? null);
  };

  const addComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !commentDraft.trim()) return;
    if (!isSharedPost(selectedPost.id)) {
      setCommunityStatus("This is a local example. Select a shared note to join its discussion.");
      return;
    }
    if (!auth.isSignedIn) { auth.requireSignIn("#feed"); return; }
    if (!auth.cloudClient || !isOnline) { setCommunityStatus("Connect to publish a comment."); return; }
    const id = selectedPost.id;
    const author = (profile.displayName.trim() || "Anonymous garage member").slice(0, 80);
    const body = commentDraft.trim();
    setCommunityBusy(true);
    try {
      await publishCommunityComment(auth.cloudClient, id, author, body);
      setSharedPosts(current => current.map(post => post.id === id
        ? { ...post, comments: [`${author}: ${body}`, ...post.comments] } : post));
      setCommentDraft("");
      setCommunityStatus("");
      try {
        if (!auth.cloudToken) throw new Error("Sign in to read comments.");
        const comments = await loadCommunityComments(auth.cloudClient, auth.cloudToken, id);
        setSharedPosts(current => current.map(post => post.id === id ? { ...post, comments } : post));
      } catch {
        setCommunityStatus("Comment published. Discussion could not refresh yet.");
      }
    } catch (error) {
      setCommunityStatus(error instanceof Error ? error.message : "Comment failed. Please retry.");
    } finally { setCommunityBusy(false); }
  };

  const reportSelectedPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPost || !reportDraft.trim()) return;
    if (isSharedPost(selectedPost.id)) {
      if (!auth.cloudClient || !isOnline) { setActionMessage("Connect to send this report."); return; }
      const sent = reportDraft;
      setCommunityBusy(true);
      try {
        await reportCommunityPost(auth.cloudClient, selectedPost.id, sent.trim().slice(0, 2000));
        // Leave the box alone if the member has moved on to another note or kept typing.
        setReportDraft(current => current === sent ? "" : current);
        setActionMessage("Report sent to moderators.");
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Report could not be sent. Please retry.");
      } finally { setCommunityBusy(false); }
      return;
    }
    const report = createReport({
      postId: selectedPost.id,
      postTitle: selectedPost.title,
      reason: reportDraft.trim(),
      reporterName: profile.displayName.trim() || "Anonymous reporter",
    });
    persistReports([report, ...reports]);
    setReportDraft("");
    setActionMessage("Report draft saved on this device. It has not been sent to moderators.");
  };

  const deleteSelectedSharedPost = async () => {
    if (!selectedPost || !myPostIds?.has(selectedPost.id)) return;
    if (!auth.cloudClient || !isOnline) { setActionMessage("Connect to delete this note."); return; }
    if (!window.confirm("Delete this note and its discussion for everyone? This cannot be undone.")) return;
    const id = selectedPost.id;
    setCommunityBusy(true);
    try {
      await deleteCommunityPost(auth.cloudClient, id);
      setSharedPosts(current => current.filter(post => post.id !== id));
      setMyPostIds(current => current && new Set([...current].filter(postId => postId !== id)));
      if (saved.has(id)) {
        const nextSaved = new Set(saved);
        nextSaved.delete(id);
        setSaved(nextSaved);
        saveSaved(nextSaved);
      }
      setCommunityStatus("");
      setActionMessage("Note deleted.");
      requestAnimationFrame(() => document.getElementById("note-detail")?.focus());
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Note could not be deleted. Please retry.");
    } finally { setCommunityBusy(false); }
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
      title: "Otofolks garage export",
      text: buildGarageExportMarkdown(garage, timeline),
    });
  };

  const addShortlistItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shortlistDraft.model.trim()) return;
    if (shortlist.some(item => item.brand === shortlistDraft.brand && item.model === shortlistDraft.model && item.variant === shortlistDraft.variant && item.state === shortlistDraft.state)) {
      setActionMessage("That car and variant are already in your comparison.");
      return;
    }
    persistShortlist([
      {
        ...createShortlistItem({
          ...shortlistDraft,
          budget: shortlistDraftPrice,
          priceSource: shortlistDraftSource,
        }),
      },
      ...shortlist,
    ]);
    setShortlistDraft(initialShortlistDraft);
    setDealerQuote(0);
  };

  const addSelectedToShortlist = () => {
    if (!selectedPost) return;
    const alreadyShortlisted = shortlist.some(
      (item) => modelKeyFor(item.brand, item.model) === modelKeyFor(selectedPost.brand, selectedPost.model),
    );
    if (alreadyShortlisted) {
      setActionMessage("That model is already in Compare.");
      return;
    }
    persistShortlist([
      createShortlistItem({
        brand: selectedPost.brand,
        budget: priceForModel(
          selectedPost.brand,
          selectedPost.model,
          firstVariantForModel(selectedPost.brand, selectedPost.model),
          stateForCity(selectedPost.city) || defaultPriceState,
          "New",
        ),
        model: selectedPost.model,
        notes: `Added from: ${selectedPost.title}`,
        priceSource: priceSourceFor(stateForCity(selectedPost.city) || defaultPriceState, "New"),
        state: stateForCity(selectedPost.city) || defaultPriceState,
        status: "New",
        variant: firstVariantForModel(selectedPost.brand, selectedPost.model),
      }),
      ...shortlist,
    ]);
    setActionMessage(`${selectedPost.brand} ${selectedPost.model} added to Compare.`);
  };

  const updateShortlistItem = (itemId: string, patch: Partial<ShortlistItem>) => {
    persistShortlist(shortlist.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  };

  const removeShortlistItem = (itemId: string) => {
    persistShortlist(shortlist.filter((item) => item.id !== itemId));
  };

  const publishPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!auth.isSignedIn) { auth.requireSignIn("#feed"); return; }
    if (!auth.cloudClient || !isOnline) {
      setCommunityStatus("Shared publishing is unavailable. Connect and retry.");
      return;
    }
    setCommunityBusy(true);
    try {
      const post = await publishCommunityPost(auth.cloudClient, {
        ...draft,
        author: (draft.author.trim() || "Anonymous owner").slice(0, 80),
        odometerKm: Number.isFinite(draft.odometerKm) ? draft.odometerKm : 0,
      });
      setSharedPosts(current => [post, ...current]);
      setMyPostIds(current => current && new Set([...current, post.id]));
      setSelectedPost(post);
      setDraft(initialDraft);
      setQuery("");
      setMode("latest");
      setSelectedLabel("All");
      setSelectedFeedState("All");
      window.location.hash = "feed";
      setCommunityStatus("Published to the shared community.");
    } catch (error) {
      setCommunityStatus(error instanceof Error ? error.message : "Publishing failed. Please retry.");
    } finally { setCommunityBusy(false); }
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage]);
    setVehicleDraft(initialVehicleDraft);
    setActionMessage("Vehicle saved on this device.");
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
    setActionMessage("Maintenance entry saved on this device.");
    setTimelineDraft({
      ...initialTimelineDraft,
      vehicleId: timelineDraft.vehicleId,
      happenedOn: new Date().toISOString().slice(0, 10),
    });
  };

  const shouldShowFeatures = auth.isSignedIn;
  const requireSignIn = (destination = "#top") => {
    if (shouldShowFeatures) return true;
    auth.requireSignIn(destination);
    if (!auth.isLoaded) {
      setActionMessage("Loading sign-in...");
      return false;
    }
    setActionMessage(clerkEnabled ? "Sign in to continue." : "Sign-in is temporarily unavailable. Please try again later.");
    return false;
  };
  const handleFeatureNav = (event: MouseEvent<HTMLAnchorElement>) => {
    setNavMenuOpen(false);
    if (event.currentTarget.hash !== "#top" && !shouldShowFeatures) {
      event.preventDefault();
      requireSignIn(event.currentTarget.hash);
    }
  };

  return {
    auth, clerkEnabled, posts, setPosts, sharedPosts, setSharedPosts, communityStatus, setCommunityStatus,
    communityBusy, setCommunityBusy, communityRefresh, setCommunityRefresh, profile, setProfile, reports,
    setReports, shortlist, setShortlist, saved, setSaved, follows, setFollows, subscriptionSettings,
    setSubscriptionSettings, garage, setGarage, timeline, setTimeline, query, setQuery, mode, setMode,
    selectedLabel, setSelectedLabel, selectedFeedState, setSelectedFeedState, initialPitStopCollection,
    selectedPitStopCategory, setSelectedPitStopCategory, selectedPitStopCollection,
    setSelectedPitStopCollection, activeReel, setActiveReel, selectedPost, setSelectedPost, composerOpen,
    setComposerOpen, draft, setDraft, vehicleDraft, setVehicleDraft, timelineDraft, setTimelineDraft,
    shortlistDraft, setShortlistDraft, dealerQuote, setDealerQuote, commentDraft, setCommentDraft,
    reportDraft, setReportDraft, toast, setToast, setActionMessage, myPostIds, setMyPostIds, navMenuOpen,
    setNavMenuOpen, helpfulIds, setHelpfulIds, confirmedIds, setConfirmedIds, activeView, setActiveView,
    isOnline, setIsOnline, feedPosts, notebooks, followedModelSet, followedTopicSet, filteredPosts,
    publishedPitStopClips, pitStopReels, filteredPitStopClips, selectedPitStopReels, returnNudges,
    starterProgress, completedStarterSteps, connectionStatus, notificationPreview, garageInsights,
    garageCostLedger, garageReminders, cityCircles, ownershipPlaybooks, moderationSummary, privacySummary,
    shortlistComparisons, comparisonSections, displayedComparisonSections, compareVerdict,
    inspectionChecklists, inspectionChecklistByItemId, draftQuality, selectedPostQuality,
    shortlistDraftPrice, shortlistDraftSource, shortlistDraftDetails, persistPosts, persistFollows,
    persistSubscriptionSettings, persistProfile, persistReports, persistShortlist, persistGarage,
    persistTimeline, toggleSaved, toggleFollowModel, toggleFollowTopic, markHelpful, confirmFix,
    addComment, reportSelectedPost, deleteSelectedSharedPost, setReportStatus, removeReportedPost,
    shareText, shareSelectedPost, shareModelNotebook, exportGarage, addShortlistItem,
    addSelectedToShortlist, updateShortlistItem, removeShortlistItem, publishPost, addVehicle,
    addTimelineNote, shouldShowFeatures, requireSignIn, handleFeatureNav,
  };
}

export type Otofolks = ReturnType<typeof useOtofolksState>;

const OtofolksContext = createContext<Otofolks | null>(null);
export const OtofolksProvider = OtofolksContext.Provider;

export function useOtofolks(): Otofolks {
  const value = useContext(OtofolksContext);
  if (!value) throw new Error("useOtofolks must be used inside OtofolksApp");
  return value;
}
