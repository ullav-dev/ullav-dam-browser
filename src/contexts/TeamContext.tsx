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

interface TeamState {
  teams: TeamSummary[];
  isLoading: boolean;
  reload: () => Promise<void>;
  createTeam: (payload: CreateTeamPayload) => Promise<Team>;
  updateTeam: (id: string, patch: UpdateTeamPayload) => Promise<Team>;
  deleteTeam: (id: string) => Promise<void>;
  getTeamDetail: (id: string) => Promise<Team>;
}

const TeamContext = createContext<TeamState>({
  teams: [],
  isLoading: false,
  reload: async () => {},
  createTeam: async () => { throw new Error("TeamProvider not mounted"); },
  updateTeam: async () => { throw new Error("TeamProvider not mounted"); },
  deleteTeam: async () => {},
  getTeamDetail: async () => { throw new Error("TeamProvider not mounted"); },
});

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      setTeams(await getMyTeams(token));
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      reload();
    } else {
      setTeams([]);
    }
  }, [token, user, reload]);

  const createTeam = useCallback(
    async (payload: CreateTeamPayload): Promise<Team> => {
      const team = await apiCreateTeam(token!, payload);
      await reload();
      return team;
    },
    [token, reload]
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
    <TeamContext.Provider value={{ teams, isLoading, reload, createTeam, updateTeam, deleteTeam, getTeamDetail }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
