// DEVELOPMENT MODE ONLY. Used when Supabase env vars are missing.
// Data lives in this browser's localStorage: no accounts, no cloud sync, no
// sharing. The UI states this clearly rather than pretending otherwise.
import { listSubtreeIds } from "../utils/listTree";

const KEY = "ordly.local.v1";
const LOCAL_USER = { id: "local-user", email: "this-device", name: "You" };

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { lists: [] };
  } catch {
    return { lists: [] };
  }
};
const write = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const mutate = (fn) => {
  const db = read();
  fn(db);
  write(db);
};
const unsupported = () => {
  throw new Error(
    "Sharing needs a Supabase backend. See the README for setup.",
  );
};
const bump = (list) => {
  list.updated_at = new Date().toISOString();
};

export const localApi = {
  capabilities: {
    auth: false,
    sharing: false,
    realtime: false,
    inviteEmail: false,
  },

  async getUser() {
    return LOCAL_USER;
  },
  onAuthChange() {
    return () => {};
  },
  async signUp() {
    unsupported();
  },
  async signIn() {
    unsupported();
  },
  async signOut() {},
  async sendPasswordReset() {
    unsupported();
  },
  async updatePassword() {
    unsupported();
  },
  async updateProfile() {},

  async fetchWorkspace() {
    return read().lists.map((l) => ({ ...l, role: "owner" }));
  },
  async createList(list) {
    mutate((db) => {
      if (!db.lists.some((l) => l.id === list.id))
        db.lists.unshift({ ...list, items: list.items || [] });
    });
  },
  async updateList(id, patch) {
    mutate((db) => {
      const l = db.lists.find((x) => x.id === id);
      if (l) Object.assign(l, patch, { updated_at: new Date().toISOString() });
    });
  },
  async updateLists(ids, patch) {
    const set = new Set(ids);
    mutate((db) => {
      for (const l of db.lists)
        if (set.has(l.id))
          Object.assign(l, patch, { updated_at: new Date().toISOString() });
    });
  },
  async deleteList(id) {
    // Like the database, deleting a list takes the lists inside it too.
    mutate((db) => {
      const gone = new Set(listSubtreeIds(db.lists, id));
      db.lists = db.lists.filter((l) => !gone.has(l.id));
    });
  },
  async insertItems(items) {
    mutate((db) => {
      for (const it of items) {
        const l = db.lists.find((x) => x.id === it.list_id);
        if (l && !l.items.some((i) => i.id === it.id)) {
          l.items.push(it);
          bump(l);
        }
      }
    });
  },
  async updateItem(id, patch) {
    mutate((db) => {
      for (const l of db.lists) {
        const it = l.items.find((i) => i.id === id);
        if (it) {
          Object.assign(it, patch, { updated_at: new Date().toISOString() });
          bump(l);
        }
      }
    });
  },
  async updateItems(ids, patch) {
    const set = new Set(ids);
    mutate((db) => {
      for (const l of db.lists)
        for (const it of l.items)
          if (set.has(it.id)) {
            Object.assign(it, patch, { updated_at: new Date().toISOString() });
            bump(l);
          }
    });
  },
  async deleteItems(ids) {
    const set = new Set(ids);
    mutate((db) => {
      for (const l of db.lists) {
        const n = l.items.length;
        l.items = l.items.filter((i) => !set.has(i.id));
        if (n !== l.items.length) bump(l);
      }
    });
  },
  subscribe() {
    return () => {};
  },

  async listShares() {
    unsupported();
  },
  async createShare() {
    unsupported();
  },
  async setSharePermission() {
    unsupported();
  },
  async setShareExpiry() {
    unsupported();
  },
  async revokeShare() {
    unsupported();
  },
  async getSharedList() {
    return null;
  },
  async redeemShare() {
    unsupported();
  },
  async collaborators() {
    return [];
  },
  async removeMember() {
    unsupported();
  },
  async listTemplates() {
    return read().templates || [];
  },
  async createTemplate(t) {
    mutate((db) => {
      db.templates = db.templates || [];
      if (!db.templates.some((x) => x.id === t.id)) db.templates.unshift(t);
    });
  },
  async deleteTemplate(id) {
    mutate((db) => {
      db.templates = (db.templates || []).filter((x) => x.id !== id);
    });
  },
  async setMemberRole() {
    unsupported();
  },
  async invites() {
    return [];
  },
  async inviteByEmail() {
    unsupported();
  },
  async removeInvite() {
    unsupported();
  },
  async sendInviteEmail() {
    unsupported();
  },
};
