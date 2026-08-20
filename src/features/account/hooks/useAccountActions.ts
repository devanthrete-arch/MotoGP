import { type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  buildAutoflexBackup,
  clearAutoflexData,
  parseAutoflexBackup,
  restoreAutoflexBackup,
} from "../../../infrastructure/storage/localStore";
import { loadCloudBackup, saveCloudBackup, sendCloudSignInLink, signOutCloud } from "../../../infrastructure/cloud/cloudSync";
import { type CloudUser } from "../../../infrastructure/supabase/auth";

/**
 * The owner's control over their own data: download a copy, restore one, wipe
 * the device, and the four account-sync actions. Every failure path here ends
 * in user-facing copy rather than a throw, because the local copy is always
 * the one the app renders from.
 */
export function useAccountActions({
  cloudEmail,
  cloudUser,
  setActionMessage,
  setCloudBackupUpdatedAt,
  setCloudBusy,
  setCloudReadyToSync,
  setCloudUser,
  setConfirmClearData,
  writeCloudOwner,
}: {
  cloudEmail: string;
  cloudUser: CloudUser | null;
  setActionMessage: Dispatch<SetStateAction<string>>;
  setCloudBackupUpdatedAt: Dispatch<SetStateAction<string | null>>;
  setCloudBusy: Dispatch<SetStateAction<boolean>>;
  setCloudReadyToSync: Dispatch<SetStateAction<boolean>>;
  setCloudUser: Dispatch<SetStateAction<CloudUser | null>>;
  setConfirmClearData: Dispatch<SetStateAction<boolean>>;
  writeCloudOwner: (userId: string | null) => void;
}) {
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

  return {
    clearAllData,
    disconnectCloud,
    downloadBackup,
    requestCloudSignIn,
    restoreBackup,
    restoreCloudData,
    uploadCloudBackup,
  };
}
