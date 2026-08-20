export type ConnectionStatusCopy = {
  label: string;
  detail: string;
  tone: "online" | "offline";
};

export function buildConnectionStatusCopy(isOnline: boolean): ConnectionStatusCopy {
  if (isOnline) {
    return {
      detail: "Online for sharing, deploy checks, and future hosted sync. Local garage work still saves in this browser.",
      label: "Online",
      tone: "online",
    };
  }

  return {
    detail: "Offline mode: posts, garage notes, backups, and feedback still work locally. Sharing and future hosted sync can wait.",
    label: "Offline",
    tone: "offline",
  };
}
