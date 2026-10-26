import { supabase } from "../lib/supabase";

const fail = (error, fallback) => {
  if (!error) return;
  const e = new Error(error.message || fallback || "Something went wrong");
  e.code = error.code;
  e.status = error.status;
  throw e;
};

const toUser = (u) =>
  u
    ? {
        id: u.id,
        email: u.email,
        name: u.user_metadata?.display_name || (u.email || "").split("@")[0],
      }
    : null;

// The user whose email invites were already claimed in this page session.
let claimedFor = null;

export const supabaseApi = {
  capabilities: {
    auth: true,
    sharing: true,
    realtime: true,
    inviteEmail: true,
  },

  // ---------- Auth ----------
  async getUser() {
    const { data, error } = await supabase.auth.getSession();
    fail(error);
    return toUser(data.session?.user);
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((event, session) =>
      cb(event, toUser(session?.user)),
    );
    return () => data.subscription.unsubscribe();
  },
  async signUp({ email, password, name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || email.split("@")[0] },
        emailRedirectTo: window.location.origin + "/app",
      },
    });
    fail(error);
    // No session means the project requires email confirmation.
    return { user: toUser(data.user), needsConfirmation: !data.session };
  },
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    fail(error);
    return toUser(data.user);
  },
  async signOut() {
    const { error } = await supabase.auth.signOut();
    fail(error);
  },
  async sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    fail(error);
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    fail(error);
  },
  async updateProfile(userId, { name }) {
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name },
    });
    fail(error);
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ display_name: name })
      .eq("id", userId);
    fail(e2);
  },

  // ---------- Lists & items ----------
  async fetchWorkspace(userId) {
    // Once per sign-in: turn any email invites for this user into real access.
    // Best-effort: the workspace must still load if this fails.
    if (claimedFor !== userId) {
      claimedFor = userId;
      await supabase.rpc("claim_invites");
    }
    const [listsRes, membersRes] = await Promise.all([
      supabase
        .from("lists")
        .select("*, list_items(*)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("list_members")
        .select("list_id, role")
        .eq("user_id", userId),
    ]);
    fail(listsRes.error);
    fail(membersRes.error);
    const roles = Object.fromEntries(
      (membersRes.data || []).map((m) => [m.list_id, m.role]),
    );
    return listsRes.data.map(({ list_items, ...list }) => ({
      ...list,
      role: list.owner_id === userId ? "owner" : roles[list.id] || "viewer",
      items: list_items || [],
    }));
  },
  async createList(list) {
    const { id, title, description, icon, color, favorite, archived } = list;
    const { parent_list_id, list_type, due_date, due_time, priority, tags } =
      list;
    const { error } = await supabase.from("lists").upsert(
      {
        id,
        title,
        description,
        icon,
        color,
        favorite,
        archived,
        // Only sent for sub-lists, so top-level lists keep saving even before sub-lists.sql is run.
        ...(parent_list_id ? { parent_list_id } : {}),
        // Likewise only sent when set, so plain lists save even before enhanced-lists.sql is run.
        ...(list_type && list_type !== "checklist" ? { list_type } : {}),
        ...(due_date ? { due_date, due_time: due_time || null } : {}),
        ...(priority ? { priority } : {}),
        ...(tags?.length ? { tags } : {}),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    fail(error);
  },
  async updateList(id, patch) {
    const { error } = await supabase.from("lists").update(patch).eq("id", id);
    fail(error);
  },
  async updateLists(ids, patch) {
    if (!ids.length) return;
    const { error } = await supabase.from("lists").update(patch).in("id", ids);
    fail(error);
  },
  async deleteList(id) {
    // list_items / list_shares / list_members, and any sub-lists, are removed by ON DELETE CASCADE.
    const { error } = await supabase.from("lists").delete().eq("id", id);
    fail(error);
  },
  async insertItems(items) {
    if (!items.length) return;
    const rows = items.map(
      ({
        id,
        list_id,
        text,
        notes,
        has_checkbox,
        completed,
        position,
        parent_id,
        due_date,
        due_time,
        priority,
        tags,
      }) => ({
        id,
        list_id,
        text,
        notes,
        has_checkbox,
        completed,
        position,
        // Only sent for sub-items, so top-level items keep saving even before nest-items.sql is run.
        ...(parent_id ? { parent_id } : {}),
        ...(due_date ? { due_date, due_time: due_time || null } : {}),
        ...(priority ? { priority } : {}),
        ...(tags?.length ? { tags } : {}),
      }),
    );
    // Re-sending the same client-generated id is a no-op, so retries never duplicate.
    const { error } = await supabase
      .from("list_items")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    fail(error);
  },
  async updateItem(id, patch) {
    const { error } = await supabase
      .from("list_items")
      .update(patch)
      .eq("id", id);
    fail(error);
  },
  async updateItems(ids, patch) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("list_items")
      .update(patch)
      .in("id", ids);
    fail(error);
  },
  async deleteItems(ids) {
    if (!ids.length) return;
    const { error } = await supabase.from("list_items").delete().in("id", ids);
    fail(error);
  },
  subscribe(onChange) {
    const channel = supabase
      .channel("ordly-workspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_items" },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "list_members" },
        onChange,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  },

  // ---------- Sharing ----------
  async listShares(listId) {
    const { data, error } = await supabase
      .from("list_shares")
      .select("*")
      .eq("list_id", listId)
      .is("revoked_at", null);
    fail(error);
    return data;
  },
  async createShare(listId, permission, expiresAt = null) {
    const { data, error } = await supabase
      .from("list_shares")
      .insert({ list_id: listId, permission, expires_at: expiresAt })
      .select()
      .single();
    fail(error);
    return data;
  },
  async setSharePermission(shareId, permission) {
    const { error } = await supabase
      .from("list_shares")
      .update({ permission })
      .eq("id", shareId);
    fail(error);
  },
  async setShareExpiry(shareId, expiresAt) {
    const { error } = await supabase
      .from("list_shares")
      .update({ expires_at: expiresAt })
      .eq("id", shareId);
    fail(error);
  },
  async revokeShare(shareId) {
    const { error } = await supabase
      .from("list_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", shareId);
    fail(error);
  },
  async getSharedList(token) {
    const { data, error } = await supabase.rpc("get_shared_list", {
      p_token: token,
    });
    fail(error);
    return data; // null when the link is unknown, revoked or expired
  },
  async redeemShare(token) {
    const { data, error } = await supabase.rpc("redeem_share", {
      p_token: token,
    });
    fail(error);
    return data;
  },
  async collaborators(listId) {
    const { data, error } = await supabase.rpc("list_collaborators", {
      p_list_id: listId,
    });
    fail(error);
    return data || [];
  },
  async removeMember(listId, userId) {
    const { error } = await supabase
      .from("list_members")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", userId);
    fail(error);
  },
  // ---------- Templates ----------
  async listTemplates() {
    const { data, error } = await supabase
      .from("list_templates")
      .select("id, title, icon, color, description, items, created_at")
      .order("created_at", { ascending: false });
    fail(error);
    return data || [];
  },
  async createTemplate(t) {
    const { id, title, icon, color, description, items } = t;
    const { error } = await supabase
      .from("list_templates")
      .upsert(
        { id, title, icon, color, description, items },
        { onConflict: "id", ignoreDuplicates: true },
      );
    fail(error);
  },
  async deleteTemplate(id) {
    const { error } = await supabase
      .from("list_templates")
      .delete()
      .eq("id", id);
    fail(error);
  },

  async setMemberRole(listId, userId, role) {
    const { error } = await supabase.rpc("set_member_role", {
      p_list_id: listId,
      p_user_id: userId,
      p_role: role,
    });
    fail(error);
  },
  async invites(listId) {
    const { data, error } = await supabase
      .from("list_invites")
      .select("id, email, role, created_at, emailed_at, email_count")
      .eq("list_id", listId)
      .order("created_at");
    fail(error);
    return data || [];
  },
  // Adding the same email again just changes its role.
  // `extra` ({ message, includePreview }) is what the invite email shows besides the list name;
  // leave it out (for example when only changing a role) and those stay as they were.
  async inviteByEmail(listId, email, role, extra) {
    const { data, error } = await supabase
      .from("list_invites")
      .upsert(
        {
          list_id: listId,
          email: email.trim().toLowerCase(),
          role,
          ...(extra
            ? {
                message: extra.message?.trim().slice(0, 300) || null,
                include_preview: extra.includePreview !== false,
              }
            : {}),
        },
        { onConflict: "list_id,email" },
      )
      .select("id")
      .single();
    fail(error);
    return data?.id;
  },
  // Asks the send-invite function (supabase/functions/send-invite) to email the invite. It only
  // gets the invite's id; the database decides who it is for and whether it may be sent now.
  // Failures carry a `code` (see utils/invite.js) so the screen can explain them.
  async sendInviteEmail(inviteId) {
    const { data, error } = await supabase.functions.invoke("send-invite", {
      body: { invite_id: inviteId },
    });
    if (!error) return data;
    let code = "unreachable";
    let detail = "";
    const res = error.context;
    if (res && typeof res.json === "function") {
      if (res.status === 404) code = "not_deployed";
      else {
        try {
          const body = await res.json();
          code = body.error || "failed";
          detail = body.provider_message || (body.missing || []).join(", ");
        } catch {
          code = "failed";
        }
      }
    }
    throw Object.assign(new Error(code), { code, detail });
  },
  async removeInvite(inviteId) {
    const { error } = await supabase
      .from("list_invites")
      .delete()
      .eq("id", inviteId);
    fail(error);
  },
};
