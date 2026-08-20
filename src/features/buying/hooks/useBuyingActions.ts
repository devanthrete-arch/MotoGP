import { type Dispatch, type FormEvent, type RefObject, type SetStateAction } from "react";
import { modelKeyFor, type DraftShortlistItem, type OwnerPost, type ShortlistItem } from "../../../core";
import { createShortlistItem } from "../../../infrastructure/storage/localStore";
import { initialShortlistDraft } from "../domain/drafts";

/** Adding to, editing and clearing the buyer shortlist. */
export function useBuyingActions({
  persistShortlist,
  selectedPost,
  setActionMessage,
  setShortlistDraft,
  setShortlistFormOpen,
  shortlist,
  shortlistDraft,
  shortlistHeadingRef,
}: {
  persistShortlist: (next: ShortlistItem[]) => void;
  selectedPost: OwnerPost | null;
  setActionMessage: Dispatch<SetStateAction<string>>;
  setShortlistDraft: Dispatch<SetStateAction<DraftShortlistItem>>;
  setShortlistFormOpen: Dispatch<SetStateAction<boolean>>;
  shortlist: ShortlistItem[];
  shortlistDraft: DraftShortlistItem;
  shortlistHeadingRef: RefObject<HTMLHeadingElement | null>;
}) {
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

  return {
    addSelectedToShortlist,
    addShortlistItem,
    removeShortlistItem,
    updateShortlistItem,
  };
}
