"use client";

// Thin comad-specific wrapper around @ullav-dev/tack-notes's TackNotesPanel
// -- the entity-attached notes widget for a single asset or category (per
// Phase B of the comad+cartlann tack-notes migration plan). Mirrors cunav's
// own NotesPanel.tsx wrapper (the pilot app for this pattern), minus the
// AI/inbound-email author special-casing that's specific to cunav's ticket
// notes -- comad has no equivalent system-authored notes yet.
//
// Everything comad-specific lives here, not in the shared package:
// - resolveAuthor: batches roster lookups via ullav-user-management's
//   generic /users/resolve endpoint (same one cunav/togra use).
// - owningService/entityType/entityId: scopes notes to the specific asset
//   or category this panel is mounted for via tack-server's
//   content_attachments.
// - teamId: comad has a real team switcher (unlike cunav), so this uses
//   the active team from TeamContext, not just the first Tack-enabled team.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { isAdmin as isAdminToken, resolveUsers, type ResolvedUser } from "@/lib/auth-api";
import { createTackNotesApi, TackNotesPanel, type Note as TackNote } from "@ullav-dev/tack-notes";

/** New identity for comad's own notes -- comad has no pre-existing notes
 * data to preserve continuity with (unlike awe-server's apps), so this is
 * just comad's own service name, picked fresh. */
const OWNING_SERVICE = "comad";

export type NotesEntityType = "asset" | "category";

interface NotesPanelProps {
  entityType: NotesEntityType;
  entityId: string;
  autoSelectFirst?: boolean;
  compact?: boolean;
  renderNoteActions?: (note: TackNote) => ReactNode;
  refreshSignal?: number;
}

export default function NotesPanel({ entityType, entityId, autoSelectFirst = false, compact = false, renderNoteActions, refreshSignal }: NotesPanelProps) {
  const { user, token } = useAuth();
  const { activeTeam } = useTeam();
  const t = useTranslations("notes");

  const api = useMemo(() => (token ? createTackNotesApi("/api/tack", token) : null), [token]);
  const teamId = activeTeam?.id ?? null;

  // Roster resolution, lazily batched: each not-yet-seen created_by
  // encountered by resolveAuthor is queued, then resolved in one request
  // shortly after (rather than one request per note per render).
  const [roster, setRoster] = useState<Record<string, ResolvedUser>>({});
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  const pendingRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function queueRosterLookup(userId: string) {
    if (!token || rosterRef.current[userId] || pendingRef.current.has(userId)) return;
    pendingRef.current.add(userId);
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      const ids = Array.from(pendingRef.current);
      pendingRef.current.clear();
      flushTimerRef.current = null;
      resolveUsers(token, ids)
        .then((resolved) => {
          setRoster((prev) => ({ ...prev, ...Object.fromEntries(resolved.map((u) => [u.id, u])) }));
        })
        .catch(() => {
          /* Non-fatal: these authors just keep showing a truncated id. */
        });
    }, 150);
  }

  function resolveAuthor(userId: string, _teamId: string | null): string {
    if (userId === user?.id) return user.username ?? t("you");
    const person = roster[userId];
    if (person) return `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() || person.username;
    queueRosterLookup(userId);
    return `${userId.slice(0, 8)}…`;
  }

  if (!token || !api || !teamId) {
    return <div className="text-sm text-slate-400 py-6 text-center">{t("loading")}</div>;
  }

  return (
    <TackNotesPanel
      api={api}
      owningService={OWNING_SERVICE}
      entityType={entityType}
      entityId={entityId}
      teamId={teamId}
      currentUserId={user?.id ?? ""}
      isAdmin={isAdminToken(token)}
      resolveAuthor={resolveAuthor}
      t={t}
      editable
      showFolders
      compact={compact}
      autoSelectFirst={autoSelectFirst}
      defaultVisibility="team"
      showUnreadBadges
      refreshSignal={refreshSignal}
      renderNoteActions={renderNoteActions}
    />
  );
}
