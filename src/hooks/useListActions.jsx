import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { MoveListModal } from "../components/lists/MoveListModal";
import { useToast } from "../contexts/ToastContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { api } from "../services/api";
import { plural } from "../utils/format";
import { listDescendantIds, listSubtreeIds } from "../utils/listTree";

/**
 * Favorite / archive / move / delete for any list, used by the sidebar menus and the list
 * header menu. Archiving or deleting a list also takes the lists inside it, so those two
 * ask first when there are any. Render `dialogs` once somewhere on the page.
 */
export function useListActions() {
  const ws = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { listId: openId } = useParams();
  const [pending, setPending] = useState(null);
  const [pendingArchive, setPendingArchive] = useState(null);
  const [moving, setMoving] = useState(null);

  const subCount = (list) => listDescendantIds(ws.lists, list.id).length;

  const toggleFavorite = (list) =>
    ws.updateList(list.id, { favorite: !list.favorite });

  const doArchive = (list) => {
    const result = ws.setListArchived(list.id, !list.archived);
    const subs = result.ids.length - 1;
    toast({
      tone: "success",
      message: `${list.archived ? "List restored" : "List archived"}${subs ? ` with ${plural(subs, "sub-list")}` : ""}`,
      action: { label: "Undo", onClick: () => ws.undoArchive(result) },
    });
  };

  // Restoring never asks; archiving asks only when there are sub-lists to take along.
  const archive = (list) => {
    if (!list.archived && subCount(list) > 0) setPendingArchive(list);
    else doArchive(list);
  };

  const move = (list, parentId) => {
    if (!ws.moveList(list.id, parentId)) {
      toast({ tone: "error", message: "That list can’t go there." });
      return;
    }
    const target = parentId ? ws.getList(parentId) : null;
    toast({
      tone: "success",
      message: target
        ? `Moved into “${target.title}”`
        : "Moved to the top level",
    });
  };

  // What deleting `pending` takes with it: the list, the lists inside it and all their items.
  const doomed = pending
    ? ws.lists.filter((l) =>
        listSubtreeIds(ws.lists, pending.id).includes(l.id),
      )
    : [];
  const doomedItems = doomed.reduce((n, l) => n + l.items.length, 0);
  const doomedSubs = Math.max(0, doomed.length - 1);

  const dialogs = (
    <>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        danger
        confirmLabel="Delete list"
        title={`Delete “${pending?.title ?? ""}”?`}
        description={`This permanently deletes the list${doomedSubs ? `, the ${plural(doomedSubs, "sub-list")} inside it,` : ""} and ${doomedSubs ? "their" : "its"} ${plural(doomedItems, "item")}${api.capabilities.sharing ? ", and revokes all share links" : ""}. This can’t be undone.`}
        onConfirm={() => {
          const ids = listSubtreeIds(ws.lists, pending.id);
          ws.deleteList(pending.id);
          // Deleting the list you are looking at (or one inside it) goes back to the home screen.
          if (ids.includes(openId)) navigate("/app");
          toast({ message: "List deleted" });
        }}
      />
      <ConfirmDialog
        open={!!pendingArchive}
        onClose={() => setPendingArchive(null)}
        confirmLabel="Archive"
        title={`Archive “${pendingArchive?.title ?? ""}”?`}
        description={`This also archives the ${plural(pendingArchive ? subCount(pendingArchive) : 0, "sub-list")} inside it. You can undo this right after, or restore them later from Archived.`}
        onConfirm={() => doArchive(pendingArchive)}
      />
      <MoveListModal
        list={moving}
        lists={ws.lists}
        onClose={() => setMoving(null)}
        onPick={(parentId) => {
          move(moving, parentId);
          setMoving(null);
        }}
      />
    </>
  );

  return {
    toggleFavorite,
    archive,
    askDelete: setPending,
    askMove: setMoving,
    moveTo: move,
    dialogs,
  };
}
