import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../contexts/ToastContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { api } from "../services/api";
import { plural } from "../utils/format";

/**
 * Favorite / archive / delete for any list, used by the sidebar menus.
 * Render `deleteDialog` once somewhere on the page.
 */
export function useListActions() {
  const ws = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { listId: openId } = useParams();
  const [pending, setPending] = useState(null);

  const toggleFavorite = (list) =>
    ws.updateList(list.id, { favorite: !list.favorite });

  const archive = (list) => {
    ws.updateList(list.id, { archived: !list.archived });
    toast({
      tone: "success",
      message: list.archived ? "List restored" : "List archived",
      action: {
        label: "Undo",
        onClick: () => ws.updateList(list.id, { archived: list.archived }),
      },
    });
  };

  const deleteDialog = (
    <ConfirmDialog
      open={!!pending}
      onClose={() => setPending(null)}
      danger
      confirmLabel="Delete list"
      title={`Delete “${pending?.title ?? ""}”?`}
      description={`This permanently deletes the list and its ${plural(pending?.items.length ?? 0, "item")}${api.capabilities.sharing ? ", and revokes all share links" : ""}. This can’t be undone.`}
      onConfirm={() => {
        ws.deleteList(pending.id);
        // Deleting the list you are looking at takes you back to the home screen.
        if (pending.id === openId) navigate("/app");
        toast({ message: "List deleted" });
      }}
    />
  );

  return { toggleFavorite, archive, askDelete: setPending, deleteDialog };
}
