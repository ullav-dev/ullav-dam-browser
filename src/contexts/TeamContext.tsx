"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Team, TeamSummary } from "@/lib/types";
import {
  getMyTeams,
  getTeam,
  createTeam as apiCreateTeam,
  updateTeam as apiUpdateTeam,
  deleteTeam as apiDeleteTeam,
  type CreateTeamPayload,
  type UpdateTeamPayload,
} from "@/lib/teams-api";
import { useAuth } from "./AuthContext";

const ACTIVE_TEAM_KEY = "dam_active_team_id";

interface TeamState {
  teams: TeamSummary[];
  activeTeam: TeamSummary | null;
  setActiveTeam: (team: TeamSummary | null) => void;
  isLoading: boolean;
  reload: () => Promise<void>;
  createTeam: (payload: CreateTeamPayload) => Promise<Team>;
  updateTeam: (id: string, patch: UpdateTeamPayload) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  getTeamDetail: (id: string) => Promise<Team>;
}

const TeamContext = createContext<TeamState>({
  teams: [],
  activeTeam: null,
  setActiveTeam: () => {},
  isLoading: false,
  reload: async () => {},
  createTeam: async () => { throw new Error("TeamProvider not mounted"); },
  updateTeam: async () => { throw new Error("TeamProvider not mounted"); },
  deleteTeam: async () => {},
  getTeamDetail: async () => { throw new Error("TeamProvider not mounted"); },
});

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { token, user, refresh } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeam, setActiveTeamState] = useState<TeamSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setActiveTeam = useCallback((team: TeamSummary | null) => {
    setActiveTeamState(team);
    try {
      if (team) localStorage.setItem(ACTIVE_TEAM_KEY, team.id);
      else localStorage.removeItem(ACTIVE_TEAM_KEY);
    } catch { /* ignore */ }
  }, []);

  const reload = useCallback(async () => {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      const myTeams = await getMyTeams(token);
      setTeams(myTeams);
      // Restore persisted active team, validating it's still in the list.
      try {
        const savedId = localStorage.getItem(ACTIVE_TEAM_KEY);
        if (savedId) {
          const match = myTeams.find((t) => t.id === savedId);
          setActiveTeamState(match ?? null);
          if (!match) localStorage.removeItem(ACTIVE_TEAM_KEY);
        }
      } catch { /* ignore */ }
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      reload().catch((err) => console.error("[TeamContext] reload failed:", err));
    } else {
      setTeams([]);
      setActiveTeamState(null);
    }
  }, [token, user, reload]);

  const createTeam = useCallback(
    async (payload: CreateTeamPayload): Promise<Team> => {
      const team = await apiCreateTeam(token!, payload);
      await Promise.all([reload(), refresh()]);
      return team;
    },
    [token, reload, refresh]
  );

  const updateTeam = useCallback(
    async (id: string, patch: UpdateTeamPayload): Promise<Team> => {
      const team = await apiUpdateTeam(token!, id, patch);
      await reload();
      return team;
    },
    [token, reload]
  );

  const deleteTeam = useCallback(
    async (id: string): Promise<void> => {
      await apiDeleteTeam(token!, id);
      await reload();
    },
    [token, reload]
  );

  const getTeamDetail = useCallback(
    (id: string): Promise<Team> => getTeam(token!, id),
    [token]
  );

  return (
    <TeamContext.Provider value={{ teams, activeTeam, setActiveTeam, isLoading, reload, createTeam, updateTeam, deleteTeam, getTeamDetail }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
