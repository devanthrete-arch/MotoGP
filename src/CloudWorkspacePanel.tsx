import { useEffect, useRef, useState } from "react";
import type { CloudClient } from "./supabase";
import { CloudDownload, CloudUpload, RefreshCw } from "lucide-react";
import { loadCloudWorkspace, saveCloudWorkspace, type CloudWorkspace, type PrivateWorkspace } from "./cloudWorkspace";

export function CloudWorkspacePanel({ client, owner, workspace, onRestore, configurationError }: {
  client: CloudClient | null;
  owner: string;
  workspace: PrivateWorkspace;
  onRestore: (workspace: PrivateWorkspace) => void;
  configurationError?: string;
}) {
  const [remote, setRemote] = useState<CloudWorkspace | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    setReady(false);
    setRemote(null);
    if (client) {
      setBusy(true);
      inFlight.current = true;
      void loadCloudWorkspace(client, owner).then(data => {
        if (current !== generation.current) return;
        setRemote(data);
        setReady(true);
        setMessage("");
      }).catch((error: Error) => {
        if (current === generation.current) setMessage(error.message);
      }).finally(() => {
        if (current === generation.current) { setBusy(false); inFlight.current = false; }
      });
    }
    return () => { generation.current++; inFlight.current = false; };
  }, [client, owner]);

  const run = async (save: boolean) => {
    if (!client || inFlight.current || (save && !ready)) return;
    if (save && remote && !window.confirm("Replace your account copy with the data currently on this device?")) return;
    const current = generation.current;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const data = save
        ? await saveCloudWorkspace(client, owner, workspace, remote?.revision ?? 0)
        : await loadCloudWorkspace(client, owner);
      if (current !== generation.current) return;
      setRemote(data);
      setReady(true);
      setMessage(save ? "Saved to your account." : "Account copy refreshed. Device data unchanged.");
    } catch (error) {
      if (current !== generation.current) return;
      setReady(false);
      setMessage(error instanceof Error ? error.message : "Account saving is unavailable. Device data unchanged.");
    } finally {
      if (current === generation.current) { setBusy(false); inFlight.current = false; }
    }
  };

  return <div className="cloud-workspace" aria-label="Account storage">
    <h3>Your account copy</h3>
    <p role="status">{!client ? configurationError || "Account saving is not available yet. Your data stays on this device."
      : busy ? "Connecting to your account..." : message || (remote ? `Last saved ${new Date(remote.updatedAt).toLocaleString()}` : ready ? "No account copy yet." : "Account copy unavailable.")}</p>
    {client ? <>
      <p className="form-note">Garage, maintenance, profile, shortlist and saved advice. Community drafts and registration numbers stay on this device.</p>
      <div className="auth-actions">
        <button className="primary-action" type="button" disabled={busy || !ready} onClick={() => void run(true)}><CloudUpload size={18} aria-hidden="true" />Save to account</button>
        <button className="secondary-action" type="button" disabled={busy || !ready || !remote} onClick={() => {
          if (!remote || !window.confirm("Replace this device's garage, maintenance, profile, shortlist and saved advice with your account copy? Community drafts will not change.")) return;
          onRestore(remote.payload);
          setMessage("Account copy restored to this device.");
        }}><CloudDownload size={18} aria-hidden="true" />Restore from account</button>
        <button className="secondary-action" type="button" title="Refresh account copy" aria-label="Refresh account copy" disabled={busy} onClick={() => void run(false)}><RefreshCw size={18} aria-hidden="true" /></button>
      </div>
    </> : null}
  </div>;
}
