// All state and behaviour of the signed-in app, as one hook. Views read it through useOtofolks().
// It is one hook because the features still share state; split it per feature as each is rebuilt.
import { FormEvent, MouseEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import {
  deleteCommunityPost, isSharedPost, loadCommunityComments, loadCommunityPosts, loadMyCommunityPostIds,
  publishCommunityComment, publishCommunityPost, reportCommunityPost,
} from "../communityCloud";
import { toastDuration } from "../ui/Toast";
import { buildTopPitStopReels, filterPitStopClipsByCategory, pitStopClips, type PitStopClip } from "../pitstop";
import {
  type DraftPost, type DraftShortlistItem, type DraftTimelineEntry, type DraftVehicle, type FollowState,
  type GarageVehicle, type KnowledgeLabel, type OwnerPost, type Profile, type ReportRecord,
  type ShortlistItem, type TimelineEntry,
} from "../domain";
import {
  assessPostQuality, buildConnectionStatusCopy, buildGarageCostLedger, buildGarageInsights,
  buildGarageExportMarkdown, buildGarageReminders, buildInspectionChecklists, buildPostSharePayload,
  buildShortlistComparisons, filterPostsByMode, modelKeyFor,
} from "../insights";
import {
  createReport, createShortlistItem, createTimelineEntry, createVehicle, loadFollows, loadGarage,
  loadProfile, loadPosts, loadReports, loadSaved, loadShortlist, loadTimeline, loadVehiclePlates, saveFollows,
  saveGarage, savePosts, saveProfile, saveReports, saveSaved, saveShortlist, saveTimeline, saveVehiclePlates,
  setStorageUser, readStoredJson, writeStoredJson,
} from "../storage";
import { formatRegistrationInput, parseRegistration } from "../ui/plate";
import {
  adoptVisitorShortlist, claimTab, forgetPlate, loadVisitorShortlist, readMemberHint, readSigningIn, recallPlate,
  rememberPlate, saveVisitorShortlist, writeMemberHint, writeSigningIn,
} from "../visitor";
import {
  type AppAuthState, type AppProps, type AppView, type ComparisonSection, type FeedMode, type PriceState,
  type SignInMode, buildCompareVerdict, compareMetricSections, comparisonSectionTitles, defaultPriceState,
  firstVariantForModel, getInitialOnlineStatus, initialDraft, initialShortlistDraft, initialTimelineDraft,
  initialVehicleDraft, modelDetailsFor, pathForLegacyHash, pitStopCategoryFromHash, priceForModel, priceSourceFor,
  stateForCity, viewFromPath, viewPaths,
} from "./model";

// A visitor's Compare is built without owner notes: see shortlistComparisons below.
const noPosts: OwnerPost[] = [];
// How long to wait for the sign-in provider before treating whoever is here as a visitor.
const authWaitLimit = 8000;

export function useOtofolksState({ auth, clerkEnabled = false, accountPanel }: AppProps & { auth: AppAuthState }) {
  // Device data is kept per account. A visitor has none: their shortlist lives in the tab.
  const accountId = auth.isSignedIn ? auth.userId ?? null : null;
  setStorageUser(accountId);
  // The sign-in provider has not answered yet: see "audience" further down.
  const authPending = clerkEnabled && !auth.isLoaded;
  // Before anything reads the tab: what it holds must not pass to the next person to use it.
  const tabCleared = claimTab(accountId, !authPending);
  const [posts, setPosts] = useState<OwnerPost[]>(() => loadPosts());
  const [sharedPosts, setSharedPosts] = useState<OwnerPost[]>([]);
  const [communityStatus, setCommunityStatus] = useState("Loading shared notes...");
  const [communityBusy, setCommunityBusy] = useState(false);
  const [communityRefresh, setCommunityRefresh] = useState(0);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [reports, setReports] = useState<ReportRecord[]>(() => loadReports());
  const [shortlist, setShortlist] = useState<ShortlistItem[]>(() => {
    // Cars shortlisted in this tab before signing in come along, once.
    return accountId === null ? loadVisitorShortlist() : adoptVisitorShortlist();
  });
  const [saved, setSaved] = useState<Set<string>>(() => loadSaved());
  const [follows, setFollows] = useState<FollowState>(() => loadFollows());
  const [garage, setGarage] = useState<GarageVehicle[]>(() => loadGarage());
  // Registration numbers by vehicle id: on this device only, never part of the account copy.
  const [vehiclePlates, setVehiclePlates] = useState<Record<string, string>>(() => loadVehiclePlates());
  // The number being typed for the next vehicle. It starts from the one given on the landing page.
  // Deliberately not part of vehicleDraft, which becomes the saved (and uploadable) vehicle.
  const [plateDraft, setPlateDraftText] = useState(() => formatRegistrationInput(recallPlate() ?? ""));
  const setPlateDraft = (text: string) => {
    setPlateDraftText(text);
    // The tab always holds exactly what the field shows when that is a whole number, and nothing
    // otherwise: what is promised to survive a sign-in (or a reload) is what does.
    const registration = parseRegistration(text);
    if (registration.ok) rememberPlate(registration.normalized);
    else forgetPlate();
  };
  // The tab changed hands (a sign-out, or another account) after this state was first read.
  if (tabCleared && plateDraft) setPlateDraftText("");
  if (tabCleared && accountId === null && shortlist.length) setShortlist([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>(() => loadTimeline());
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<FeedMode>("latest");
  const [selectedLabel, setSelectedLabel] = useState<KnowledgeLabel | "All">("All");
  const [selectedFeedState, setSelectedFeedState] = useState<PriceState | "All">("All");
  const location = useLocation();
  const navigate = useNavigate();
  const initialPitStopCollection = pitStopCategoryFromHash(location.hash);
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
  // Which collapsible parts are open is kept here, so it survives a visit to another view.
  const [reportOpen, setReportOpen] = useState(false);
  const [openComparisonSections, setOpenComparisonSections] = useState<string[]>([comparisonSectionTitles[0]]);
  const setComparisonSectionOpen = (title: string, open: boolean) => setOpenComparisonSections(
    (titles) => open ? (titles.includes(title) ? titles : [...titles, title]) : titles.filter((value) => value !== title));
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
  // The URL decides the view. A link in the old fragment form that turns up while the app is open
  // (a fragment typed into the address bar) is sent to its path; one the app was opened with has
  // already been rewritten before first render, in OtofolksApp.
  const activeView: AppView = viewFromPath(location.pathname);
  const legacyTarget = location.pathname === "/" ? pathForLegacyHash(location.hash) : null;
  const legacyPathname = legacyTarget?.pathname;
  const legacyHash = legacyTarget?.hash;
  useEffect(() => {
    if (!legacyPathname) return;
    navigate({ pathname: legacyPathname, search: location.search, hash: legacyHash }, { replace: true });
  }, [legacyPathname, legacyHash, location.search, navigate]);
  // Arriving on a different page starts it clean: menus and overlays closed, scrolled to the top.
  // Back and Forward are left to the browser, which returns to where the page was.
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    setNavMenuOpen(false);
    setActiveReel(null);
    setComposerOpen(false);
    if (navigationType !== "POP") window.scrollTo({ top: 0 });
  }, [location.pathname, navigationType]);
  useEffect(() => {
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavMenuOpen(false);
        setActiveReel(null);
        document.querySelector<HTMLButtonElement>(".nav-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
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
  const connectionStatus = useMemo(() => buildConnectionStatusCopy(isOnline), [isOnline]);

  const garageInsights = useMemo(() => buildGarageInsights(garage, timeline, posts), [garage, posts, timeline]);
  const garageCostLedger = useMemo(() => buildGarageCostLedger(garage, timeline), [garage, timeline]);
  const garageReminders = useMemo(() => buildGarageReminders(garage, timeline), [garage, timeline]);
  // Compare is open to visitors, and the only notes on hand for a visitor are the bundled examples
  // or whatever an earlier user of this browser left behind. Neither is quoted to them.
  const compareNotes = auth.isSignedIn ? posts : noPosts;
  const shortlistComparisons = useMemo(() => buildShortlistComparisons(shortlist, compareNotes), [compareNotes, shortlist]);
  const comparisonSections = useMemo(() => compareMetricSections(shortlistComparisons), [shortlistComparisons]);
  const displayedComparisonSections: ComparisonSection[] = comparisonSections.length
    ? comparisonSections : comparisonSectionTitles.map((title) => ({ title, rows: [] }));
  const compareVerdict = useMemo(() => buildCompareVerdict(shortlistComparisons), [shortlistComparisons]);
  const inspectionChecklists = useMemo(() => buildInspectionChecklists(shortlist, compareNotes), [compareNotes, shortlist]);
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
    if (accountId === null) saveVisitorShortlist(nextShortlist);
    else saveShortlist(nextShortlist);
  };

  const persistGarage = (nextGarage: GarageVehicle[], plates = vehiclePlates) => {
    setGarage(nextGarage);
    saveGarage(nextGarage);
    // A number is kept only while its vehicle exists (restoring from the account can remove one).
    const vehicleIds = new Set(nextGarage.map((vehicle) => vehicle.id));
    const keptPlates = Object.fromEntries(Object.entries(plates).filter(([vehicleId]) => vehicleIds.has(vehicleId)));
    setVehiclePlates(keptPlates);
    saveVehiclePlates(keptPlates);
    if (!timelineDraft.vehicleId && nextGarage[0]) {
      setTimelineDraft({ ...timelineDraft, vehicleId: nextGarage[0].id });
    }
  };

  const updateVehicle = (updated: GarageVehicle, plates = vehiclePlates) => {
    if (!garage.some(vehicle => vehicle.id === updated.id)) return;
    persistGarage(garage.map(vehicle => vehicle.id === updated.id ? updated : vehicle), plates);
    setActionMessage("Vehicle details updated on this device.");
  };

  const removeVehicle = (vehicleId: string) => {
    const nextGarage = garage.filter(vehicle => vehicle.id !== vehicleId);
    persistGarage(nextGarage, Object.fromEntries(Object.entries(vehiclePlates).filter(([id]) => id !== vehicleId)));
    persistTimeline(timeline.filter(entry => entry.vehicleId !== vehicleId));
    setTimelineDraft({ ...initialTimelineDraft, vehicleId: nextGarage[0]?.id ?? "" });
    setActionMessage("Vehicle and its maintenance history removed from this device.");
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
    if (!auth.isSignedIn) { auth.requireSignIn(viewPaths.feed); return; }
    if (!auth.cloudClient || !isOnline) { setCommunityStatus("Connect to publish a comment."); return; }
    const id = selectedPost.id;
    const body = commentDraft.trim();
    setCommunityBusy(true);
    try {
      await publishCommunityComment(auth.cloudClient, id, body);
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
    if (!auth.isSignedIn) { auth.requireSignIn(viewPaths.feed); return; }
    if (draft.label === "Review" && (!draft.model.trim() || !draft.reviewPros?.trim()
      || !draft.reviewCons?.trim() || !draft.reviewVerdict)) {
      setCommunityStatus("Add the model, what worked, what to watch for, and whether you’d choose it again.");
      return;
    }
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
      navigate(viewPaths.feed);
      setCommunityStatus("Published to the shared community.");
    } catch (error) {
      setCommunityStatus(error instanceof Error ? error.message : "Publishing failed. Please retry.");
    } finally { setCommunityBusy(false); }
  };

  const addVehicle = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const registration = parseRegistration(plateDraft);
    // The number is optional, but one that was started is finished or cleared first: saving the
    // vehicle and quietly dropping what was typed would lose it without a word. The form puts the
    // reader back in the field; the message is for anyone who cannot see it from where they are.
    if (plateDraft.trim() && !registration.ok) {
      setActionMessage("Finish the registration number, or clear it, then save again.");
      return false;
    }
    const vehicle = createVehicle({
      ...vehicleDraft,
      nickname: vehicleDraft.nickname.trim() || `${vehicleDraft.brand} ${vehicleDraft.model}`,
      odometerKm: Number.isFinite(vehicleDraft.odometerKm) ? vehicleDraft.odometerKm : 0,
    });
    persistGarage([vehicle, ...garage],
      registration.ok ? { ...vehiclePlates, [vehicle.id]: registration.normalized } : vehiclePlates);
    setVehicleDraft(initialVehicleDraft);
    // Used: the next vehicle starts with an empty field, in this tab and after a reload.
    setPlateDraft("");
    setActionMessage("Vehicle saved on this device.");
    return true;
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
  // Until the sign-in provider has answered, a member looks exactly like a visitor. "unknown"
  // covers that gap so nobody is shown the other audience's page for a moment. It is capped, so
  // a provider that never loads leaves the public pages usable.
  const [authWaitOver, setAuthWaitOver] = useState(false);
  useEffect(() => {
    if (!authPending) return;
    const timer = window.setTimeout(() => setAuthWaitOver(true), authWaitLimit);
    return () => window.clearTimeout(timer);
  }, [authPending]);
  const audience: "member" | "visitor" | "unknown" = auth.isSignedIn ? "member"
    : authPending && !authWaitOver ? "unknown" : "visitor";
  // Whether this device was signed in last time, read once. It only chooses what "unknown" draws
  // on pages that visitors may also see: a placeholder for a returning member, the page otherwise.
  const [returningMember] = useState(() => readMemberHint() || readSigningIn());
  /** The pages a visitor may see are shown as a visitor sees them. */
  const visitorPages = audience === "visitor" || (audience === "unknown" && !returningMember);
  useEffect(() => {
    // The hint follows what was actually observed. If the provider never answers it is dropped
    // too, so later visits are not held on a placeholder for the full wait.
    if (auth.isSignedIn) writeMemberHint(true);
    else if (!authPending || authWaitOver) writeMemberHint(false);
    if (!authPending) writeSigningIn(false);
  }, [auth.isSignedIn, authPending, authWaitOver]);

  // `destination` is the path to return to once signed in.
  const requireSignIn = (destination = viewPaths.top, mode: SignInMode = "sign-in") => {
    if (shouldShowFeatures) return true;
    // The page load that ends a sign-in should wait for the answer, not flash the visitor's page.
    writeSigningIn(true);
    auth.requireSignIn(destination, mode);
    if (!auth.isLoaded) {
      setActionMessage("Loading sign-in...");
      return false;
    }
    setActionMessage(clerkEnabled ? "Sign in to continue." : "Sign-in is temporarily unavailable. Please try again later.");
    return false;
  };
  // Any visitor may follow any link; a members-only page shows a sign-in prompt in its place.
  const handleFeatureNav = (event: MouseEvent<HTMLAnchorElement>) => {
    setNavMenuOpen(false);
    // The link for the page already open takes the reader back to its top.
    if (event.currentTarget.pathname === location.pathname) window.scrollTo({ top: 0 });
  };
  // The account link doubles as "Sign in": for a visitor it opens sign-in on the spot and brings
  // them back to the page they were on.
  const handleAccountNav = (event: MouseEvent<HTMLAnchorElement>) => {
    if (shouldShowFeatures) { handleFeatureNav(event); return; }
    setNavMenuOpen(false);
    event.preventDefault();
    requireSignIn(location.pathname);
  };

  return {
    auth, clerkEnabled, accountPanel, audience, visitorPages, vehiclePlates, plateDraft, setPlateDraft,
    handleAccountNav, posts, setPosts, sharedPosts, setSharedPosts, communityStatus, setCommunityStatus,
    communityBusy, setCommunityBusy, communityRefresh, setCommunityRefresh, profile, setProfile, reports,
    setReports, shortlist, setShortlist, saved, setSaved, follows, setFollows, garage, setGarage, timeline,
    setTimeline, query, setQuery, mode, setMode, selectedLabel, setSelectedLabel, selectedFeedState,
    setSelectedFeedState, initialPitStopCollection, selectedPitStopCategory, setSelectedPitStopCategory,
    selectedPitStopCollection, setSelectedPitStopCollection, activeReel, setActiveReel, selectedPost,
    setSelectedPost, composerOpen, setComposerOpen, draft, setDraft, vehicleDraft, setVehicleDraft,
    timelineDraft, setTimelineDraft, shortlistDraft, setShortlistDraft, dealerQuote, setDealerQuote,
    commentDraft, setCommentDraft, reportDraft, setReportDraft, reportOpen, setReportOpen,
    openComparisonSections, setComparisonSectionOpen, toast, setToast, setActionMessage,
    myPostIds, setMyPostIds, navMenuOpen, setNavMenuOpen, helpfulIds, setHelpfulIds, confirmedIds,
    setConfirmedIds, activeView, isOnline, setIsOnline, feedPosts, followedModelSet, followedTopicSet,
    filteredPosts, publishedPitStopClips, pitStopReels, filteredPitStopClips, selectedPitStopReels,
    connectionStatus, garageInsights, garageCostLedger, garageReminders, shortlistComparisons,
    comparisonSections, displayedComparisonSections, compareVerdict, inspectionChecklists,
    inspectionChecklistByItemId, draftQuality, selectedPostQuality, shortlistDraftPrice,
    shortlistDraftSource, shortlistDraftDetails, persistPosts, persistFollows, persistProfile,
    persistReports, persistShortlist, persistGarage, persistTimeline, updateVehicle, removeVehicle, toggleSaved, toggleFollowModel,
    toggleFollowTopic, markHelpful, confirmFix, addComment, reportSelectedPost, deleteSelectedSharedPost,
    shareText, shareSelectedPost, exportGarage, addShortlistItem, addSelectedToShortlist,
    updateShortlistItem, removeShortlistItem, publishPost, addVehicle, addTimelineNote, shouldShowFeatures,
    requireSignIn, handleFeatureNav,
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
