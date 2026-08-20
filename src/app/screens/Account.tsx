import {
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Hash,
  LogOut,
  NotebookText,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  UsersRound,
} from "lucide-react";
import { garageRoles, useApp } from "../state/appState";
import { Badge, Card, DataText, EmptyState, GhostButton, LabelCaps, PrimaryButton } from "../../ui/primitives";
import type { Profile } from "../../core/entities";
import { isCloudSyncConfigured } from "../../infrastructure/supabase/client";

const inputCls =
  "w-full min-h-[44px] bg-surface-container-lowest text-on-surface text-sm border border-outline-variant rounded px-3 py-2.5 placeholder:text-outline focus:outline-none focus:border-primary transition-colors";

const listRowCls =
  "w-full flex items-center gap-3 min-h-[56px] px-4 py-3 bg-surface-container border border-outline-variant rounded-lg text-left text-on-surface hover:border-outline transition-colors";

/** Account area: profile, saved, following, notifications, settings, moderation. */
export function Account() {
  const app = useApp();
  const {
    accountView,
    profile,
    posts,
    saved,
    follows,
    notebooks,
    followedModelSet,
    subscriptionSettings,
    notificationPreview,
    reports,
    moderationSummary,
    cloudUser,
    cloudBusy,
    cloudBackupUpdatedAt,
    cloudEmail,
    confirmClearData,
  } = app;

  return (
    <div className="flex flex-col gap-8 pb-24 lg:pb-8">
      {accountView === "profile" ? (
        <section aria-label="Profile" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" id="profile">
          <Card className="flex flex-col gap-4">
            <div>
              <LabelCaps className="text-primary block mb-1">Pilot identity</LabelCaps>
              <h3 className="font-display text-xl font-semibold text-on-surface">Your name on owner notes</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                This profile stays on this device and is used when you write, comment, or report a note.
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                app.setActionMessage("Profile saved on this device.");
              }}
            >
              <label className="block">
                <LabelCaps className="text-on-surface-variant block mb-1.5">Display name</LabelCaps>
                <input
                  aria-label="Display name"
                  className={inputCls}
                  placeholder="Display name"
                  ref={app.profileNameRef}
                  value={profile.displayName}
                  onChange={(event) => app.persistProfile({ ...profile, displayName: event.target.value })}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <LabelCaps className="text-on-surface-variant block mb-1.5">City</LabelCaps>
                  <input
                    aria-label="City"
                    className={inputCls}
                    placeholder="City"
                    value={profile.city}
                    onChange={(event) => app.persistProfile({ ...profile, city: event.target.value })}
                  />
                </label>
                <label className="block">
                  <LabelCaps className="text-on-surface-variant block mb-1.5">Garage role</LabelCaps>
                  <select
                    aria-label="Garage role"
                    className={inputCls + " appearance-none"}
                    value={profile.garageRole}
                    onChange={(event) => app.persistProfile({ ...profile, garageRole: event.target.value as Profile["garageRole"] })}
                  >
                    {garageRoles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </label>
              </div>
              <DataText className="text-on-surface-variant">
                POSTING AS {(profile.displayName.trim() || "Anonymous garage member").toUpperCase()}
                {profile.city.trim() ? ` FROM ${profile.city.toUpperCase()}` : ""}
              </DataText>
              <PrimaryButton className="self-start" type="submit">
                <Check aria-hidden="true" className="w-4 h-4" />
                Save profile
              </PrimaryButton>
            </form>
          </Card>

          <nav aria-label="Profile sections" className="flex flex-col gap-2">
            <LabelCaps className="text-on-surface-variant px-1">Account modules</LabelCaps>
            {[
              {
                icon: Bookmark,
                title: "Saved notes",
                detail: `${saved.size} note${saved.size === 1 ? "" : "s"}`,
                view: "saved" as const,
              },
              {
                icon: UsersRound,
                title: "Following",
                detail: `${follows.models.length + follows.topics.length} cars and topics`,
                view: "following" as const,
              },
              { icon: Bell, title: "Notifications", detail: "Weekly updates and quiet hours", view: "notifications" as const },
              { icon: Settings, title: "Settings", detail: "Data, privacy, and app preferences", view: "settings" as const },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button className={listRowCls} key={item.view} type="button" onClick={() => app.openAccountView(item.view)}>
                  <Icon aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
                  <span className="flex-1 min-w-0">
                    <strong className="block text-sm font-semibold">{item.title}</strong>
                    <small className="block text-xs text-on-surface-variant">{item.detail}</small>
                  </span>
                  <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
                </button>
              );
            })}
          </nav>
        </section>
      ) : null}

      {accountView === "saved" ? (
        <section aria-label="Saved notes" className="flex flex-col gap-2">
          {posts
            .filter((post) => saved.has(post.id))
            .map((post) => (
              <button
                className={listRowCls}
                key={post.id}
                type="button"
                onClick={() => {
                  app.openWorkspace("community", "community", "saved");
                  app.openPostDetail(post);
                }}
              >
                <Badge className="shrink-0">{post.label}</Badge>
                <span className="flex-1 min-w-0">
                  <strong className="block text-sm font-semibold truncate">{post.title}</strong>
                  <small className="block text-xs text-on-surface-variant truncate">
                    {post.brand} {post.model} · {post.city}
                  </small>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
              </button>
            ))}
          {!saved.size ? (
            <EmptyState title="No saved notes yet">
              <p>Save any owner note from Community and it stays here for later — on this device, offline included.</p>
            </EmptyState>
          ) : null}
        </section>
      ) : null}

      {accountView === "following" ? (
        <section aria-label="Following" className="flex flex-col gap-2">
          {notebooks
            .filter((notebook) => followedModelSet.has(notebook.key))
            .map((notebook) => (
              <button
                className={listRowCls}
                key={notebook.key}
                type="button"
                onClick={() => {
                  app.setQuery(`${notebook.brand} ${notebook.model}`);
                  app.openWorkspace("community", "community", "following");
                }}
              >
                <NotebookText aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
                <span className="flex-1 min-w-0">
                  <strong className="block text-sm font-semibold">
                    {notebook.brand} {notebook.model}
                  </strong>
                  <small className="block text-xs text-on-surface-variant">{notebook.posts.length} owner notes</small>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
              </button>
            ))}
          {follows.topics.map((topic) => (
            <div className={listRowCls + " cursor-default hover:border-outline-variant"} key={topic}>
              <Hash aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
              <strong className="text-sm font-semibold">{topic}</strong>
            </div>
          ))}
          {!follows.models.length && !follows.topics.length ? (
            <EmptyState title="You are not following anything yet">
              <p>Follow a car or a topic and its model notebook collects every new owner note in one thread.</p>
            </EmptyState>
          ) : null}
        </section>
      ) : null}

      {accountView === "settings" ? (
        <section aria-label="Settings" className="flex flex-col gap-4" id="privacy">
          {isCloudSyncConfigured ? (
            <Card className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Cloud aria-hidden="true" className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <LabelCaps className="text-primary block mb-1">Cloud link</LabelCaps>
                  <h3 className="font-display text-lg font-semibold text-on-surface">Use Autoflex on another device</h3>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Sign in with your email to keep your garage, shortlist, and saved notes with your account.
                  </p>
                </div>
              </div>
              {cloudUser ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-lg p-3">
                    <LabelCaps className="text-on-surface-variant block mb-1">Signed in as</LabelCaps>
                    <DataText className="text-on-surface block">{cloudUser.email}</DataText>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {cloudBackupUpdatedAt
                        ? `Last saved ${new Date(cloudBackupUpdatedAt).toLocaleString()}`
                        : "Nothing saved to this account yet"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton disabled={cloudBusy} onClick={app.uploadCloudBackup}>
                      <Cloud aria-hidden="true" className="w-4 h-4" />
                      {cloudBackupUpdatedAt ? "Save latest changes" : "Save to my account"}
                    </PrimaryButton>
                    <GhostButton className="min-h-[44px]" disabled={cloudBusy || !cloudBackupUpdatedAt} onClick={app.restoreCloudData}>
                      <RefreshCw aria-hidden="true" className="w-4 h-4" />
                      Use saved data here
                    </GhostButton>
                    <GhostButton className="min-h-[44px]" disabled={cloudBusy} onClick={app.disconnectCloud}>
                      <LogOut aria-hidden="true" className="w-4 h-4" />
                      Sign out
                    </GhostButton>
                  </div>
                </div>
              ) : (
                <form className="flex flex-col gap-2" onSubmit={app.requestCloudSignIn}>
                  <label className="block" htmlFor="cloud-email">
                    <LabelCaps className="text-on-surface-variant block mb-1.5">Email address</LabelCaps>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      autoComplete="email"
                      className={inputCls + " sm:flex-1"}
                      id="cloud-email"
                      inputMode="email"
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={cloudEmail}
                      onChange={(event) => app.setCloudEmail(event.target.value)}
                    />
                    <PrimaryButton className="shrink-0" disabled={cloudBusy} type="submit">
                      <Cloud aria-hidden="true" className="w-4 h-4" />
                      Email me a sign-in link
                    </PrimaryButton>
                  </div>
                  <p className="text-xs text-on-surface-variant">No password required. We will email you a secure sign-in link.</p>
                </form>
              )}
            </Card>
          ) : null}

          <Card className="flex flex-col gap-3">
            <div>
              <LabelCaps className="text-primary block mb-1">Data transit</LabelCaps>
              <h3 className="font-display text-lg font-semibold text-on-surface">Move your data</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Download a copy for your records or bring an Autoflex copy onto this device.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button className={listRowCls + " bg-surface-container-lowest"} type="button" onClick={app.downloadBackup}>
                <Download aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
                <span className="flex-1 min-w-0">
                  <strong className="block text-sm font-semibold">Download a copy</strong>
                  <small className="block text-xs text-on-surface-variant">Keep your Autoflex data as a file</small>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
              </button>
              <button
                className={listRowCls + " bg-surface-container-lowest"}
                type="button"
                onClick={() => app.restoreBackupRef.current?.click()}
              >
                <Upload aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
                <span className="flex-1 min-w-0">
                  <strong className="block text-sm font-semibold">Import a copy</strong>
                  <small className="block text-xs text-on-surface-variant">Use Autoflex data from another device</small>
                </span>
                <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
              </button>
              <input
                accept="application/json,.json"
                aria-hidden="true"
                className="sr-only"
                hidden
                ref={app.restoreBackupRef}
                tabIndex={-1}
                type="file"
                onChange={app.restoreBackup}
              />
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div>
              <LabelCaps className="text-primary block mb-1">Preferences</LabelCaps>
              <h3 className="font-display text-lg font-semibold text-on-surface">Choose how Autoflex behaves</h3>
            </div>
            <button
              className={listRowCls + " bg-surface-container-lowest"}
              type="button"
              onClick={() => app.openAccountView("notifications")}
            >
              <Bell aria-hidden="true" className="w-5 h-5 text-on-surface-variant shrink-0" />
              <span className="flex-1 min-w-0">
                <strong className="block text-sm font-semibold">Notifications</strong>
                <small className="block text-xs text-on-surface-variant">Weekly updates, browser alerts, and quiet hours</small>
              </span>
              <ChevronRight aria-hidden="true" className="w-4 h-4 text-outline shrink-0" />
            </button>
          </Card>

          <Card className="border-error/40 flex flex-col gap-3">
            <div>
              <LabelCaps className="text-error block mb-1">Danger zone</LabelCaps>
              <h3 className="font-display text-lg font-semibold text-on-surface">Clear Autoflex data</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Removes your profile, garage, shortlist, saved notes, and preferences from this browser.
              </p>
            </div>
            {confirmClearData ? (
              <div className="bg-error-container/30 border border-error/40 rounded-lg p-4 flex flex-col gap-3" role="alert">
                <strong className="text-sm text-error">This cannot be undone unless you downloaded a backup.</strong>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-transparent text-on-surface border border-outline-variant hover:border-outline font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-4 py-2.5 rounded transition-colors"
                    ref={app.clearDataCancelRef}
                    type="button"
                    onClick={() => {
                      app.setConfirmClearData(false);
                      window.requestAnimationFrame(() => app.clearDataTriggerRef.current?.focus());
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-error-container text-on-error-container font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-5 py-3 rounded transition-transform active:scale-95"
                    type="button"
                    onClick={app.clearAllData}
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                    Clear all data
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="self-start inline-flex items-center gap-2 min-h-[44px] px-1 font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-error hover:underline"
                ref={app.clearDataTriggerRef}
                type="button"
                onClick={() => {
                  app.setConfirmClearData(true);
                  window.requestAnimationFrame(() => app.clearDataCancelRef.current?.focus());
                }}
              >
                <Trash2 aria-hidden="true" className="w-4 h-4" />
                Clear data on this device
              </button>
            )}
          </Card>
        </section>
      ) : null}

      {accountView === "notifications" ? (
        <section aria-label="Notifications" className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" id="notifications">
          <Card className="flex flex-col gap-4">
            <div>
              <LabelCaps className="text-primary block mb-1">Notifications</LabelCaps>
              <h3 className="font-display text-xl font-semibold text-on-surface">Choose the updates you want</h3>
              <p className="text-sm text-on-surface-variant mt-1">Weekly summaries and quiet hours are stored on this device.</p>
            </div>
            <div aria-label="Notification preferences" className="flex flex-col gap-2">
              {(
                [
                  {
                    key: "emailDigest" as const,
                    title: "Weekly digest",
                    detail: "One roundup for followed models and topics.",
                    first: true,
                  },
                  {
                    key: "browserAlerts" as const,
                    title: "Browser alerts",
                    detail: "Reserved for important updates after hosted notifications exist.",
                    first: false,
                  },
                  {
                    key: "quietHours" as const,
                    title: "Quiet hours",
                    detail: "Keep alerts muted outside useful ownership hours.",
                    first: false,
                  },
                ]
              ).map((pref) => (
                <label
                  className="flex items-start gap-3 min-h-[56px] px-4 py-3 bg-surface-container-lowest border border-outline-variant/60 rounded-lg cursor-pointer hover:border-outline transition-colors"
                  key={pref.key}
                >
                  <input
                    checked={subscriptionSettings[pref.key]}
                    className="w-5 h-5 mt-0.5 accent-primary shrink-0"
                    ref={pref.first ? app.notificationsFirstRef : undefined}
                    type="checkbox"
                    onChange={(event) =>
                      app.persistSubscriptionSettings({ ...subscriptionSettings, [pref.key]: event.currentTarget.checked })
                    }
                  />
                  <span className="min-w-0">
                    <strong className="block text-sm font-semibold text-on-surface">{pref.title}</strong>
                    <small className="block text-xs text-on-surface-variant">{pref.detail}</small>
                  </span>
                </label>
              ))}
            </div>
            <PrimaryButton
              className="self-start"
              onClick={() => app.setActionMessage("Notification settings saved on this device.")}
            >
              <Check aria-hidden="true" className="w-4 h-4" />
              Save notification settings
            </PrimaryButton>
          </Card>
          <Card className="flex flex-col gap-3 scanline">
            <LabelCaps className="text-on-surface-variant">Next digest preview</LabelCaps>
            {notificationPreview.map((preview) => (
              <p className="text-sm text-on-surface-variant border-l-2 border-outline-variant pl-3" key={preview}>
                {preview}
              </p>
            ))}
          </Card>
        </section>
      ) : null}

      <section aria-label="Moderator bay" id="moderation">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <LabelCaps className="text-primary block mb-1">Moderator bay</LabelCaps>
            <h3 className="font-display text-xl font-semibold text-on-surface">Trust tools before scale tools.</h3>
          </div>
          <div className="flex gap-2">
            <Badge tone={moderationSummary.openReports ? "error" : "default"}>{moderationSummary.openReports} open</Badge>
            <Badge>{moderationSummary.dismissedReports} dismissed</Badge>
            <Badge>{moderationSummary.removedReports} removed</Badge>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.length ? (
            reports.map((report) => (
              <Card className="flex flex-col gap-2" key={report.id}>
                <Badge className="self-start" tone={report.status === "Open" ? "error" : "default"}>
                  {report.status}
                </Badge>
                <h4 className="font-semibold text-on-surface text-sm">{report.postTitle}</h4>
                <p className="text-sm text-on-surface-variant">{report.reason}</p>
                <DataText className="text-on-surface-variant">
                  {report.reporterName.toUpperCase()} · {new Date(report.createdAt).toLocaleDateString("en-IN")}
                </DataText>
                <div className="flex flex-wrap gap-2 mt-1">
                  <GhostButton className="min-h-[44px]" onClick={() => app.setReportStatus(report.id, "Dismissed")}>
                    Dismiss
                  </GhostButton>
                  <GhostButton className="min-h-[44px] border-error/40 text-error hover:border-error" onClick={() => app.removeReportedPost(report)}>
                    Remove post
                  </GhostButton>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState className="sm:col-span-2 lg:col-span-3" title="No reports yet">
              <p>Reported notes land here with their reason and status, so nothing waits on someone remembering it.</p>
            </EmptyState>
          )}
        </div>
      </section>
    </div>
  );
}
