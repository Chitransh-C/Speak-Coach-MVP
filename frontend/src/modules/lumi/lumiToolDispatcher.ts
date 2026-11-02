import { api } from "@/shared/api/client";
import { loadSetup, saveSetup } from "@/modules/scenarios/SetupPage";
import { getLumiHistoryForTool } from "./lumiHistory";

type NavigateFn = (to: string) => void;

export type LumiToolContext = {
  token: string | null | undefined;
  userId: string;
  navigate: NavigateFn;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseObjectives(raw: string): string[] {
  return raw
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveNavigatePath(args: Record<string, unknown>): string | null {
  const path = str(args.path);
  if (path.startsWith("/")) return path;

  const destination = str(args.destination).toLowerCase().replace(/\s+/g, "_");
  const scenarioId = str(args.scenarioId);

  switch (destination) {
    case "home":
    case "scenarios":
    case "catalog":
      return "/";
    case "my_scenarios":
    case "mine":
      return "/my-scenarios";
    case "create_scenario":
    case "create":
      return "/scenarios/create";
    case "journey":
    case "progress":
      return "/journey";
    case "reports":
    case "activity":
      return "/reports";
    case "learn":
      return scenarioId ? `/scenarios/${scenarioId}/learn` : null;
    case "watch":
      return scenarioId ? `/scenarios/${scenarioId}/watch` : null;
    case "setup":
      return scenarioId ? `/scenarios/${scenarioId}/setup` : null;
    default:
      return null;
  }
}

export async function dispatchLumiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: LumiToolContext,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "navigate": {
      const to = resolveNavigatePath(args);
      if (!to) {
        return {
          ok: false,
          error: "Need a valid destination or path (and scenarioId for learn/watch/setup)",
        };
      }
      ctx.navigate(to);
      return { ok: true, path: to };
    }

    case "list_scenarios": {
      const trackId = str(args.trackId);
      const query = str(args.query).toLowerCase();
      const qs = trackId ? `?trackId=${encodeURIComponent(trackId)}` : "";
      const res = await api<{
        scenarios: {
          id: string;
          title: string;
          description: string;
          trackTitle: string;
          level: string;
          availability: string;
          status: string;
          latestScore: { overall: number; passed: boolean } | null;
          participantName: string;
        }[];
      }>(`/scenarios${qs}`, { token: ctx.token });

      let list = res.scenarios;
      if (query) {
        list = list.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            s.trackTitle.toLowerCase().includes(query) ||
            s.participantName.toLowerCase().includes(query),
        );
      }
      const items = list.slice(0, 12).map((s) => ({
        id: s.id,
        title: s.title,
        track: s.trackTitle,
        level: s.level,
        availability: s.availability,
        status: s.status,
        score: s.latestScore?.overall ?? null,
        partner: s.participantName,
      }));
      return { ok: true, count: items.length, scenarios: items };
    }

    case "start_practice": {
      const scenarioId = str(args.scenarioId);
      if (!scenarioId) return { ok: false, error: "scenarioId is required" };
      const stage = str(args.stage).toLowerCase() === "learn" ? "learn" : "setup";
      const path = `/scenarios/${scenarioId}/${stage}`;
      ctx.navigate(path);
      return { ok: true, path, note: "Opened practice path; user completes setup then starts the call." };
    }

    case "configure_setup": {
      const scenarioId = str(args.scenarioId);
      if (!scenarioId) return { ok: false, error: "scenarioId is required" };

      const detail = await api<{
        id: string;
        title: string;
        canPractice: boolean;
        participantGender?: string;
        languages: { code: string; label: string }[];
        voices: { id: string; label: string; gender: string; tone?: string }[];
        defaults: { language: string; voice: string };
      }>(`/scenarios/${scenarioId}`, { token: ctx.token });

      const saved = loadSetup(scenarioId);
      let language = str(args.language) || saved?.language || detail.defaults.language;
      let voice = str(args.voice) || saved?.voice || detail.defaults.voice;

      if (!detail.languages.some((l) => l.code === language)) {
        return {
          ok: false,
          error: `Unsupported language ${language}`,
          availableLanguages: detail.languages.map((l) => l.code),
        };
      }
      if (!detail.voices.some((v) => v.id === voice)) {
        return {
          ok: false,
          error: `Voice ${voice} not allowed for this scenario (partner is ${detail.participantGender ?? "filtered"})`,
          availableVoices: detail.voices.map((v) => ({ id: v.id, tone: v.tone })),
        };
      }

      saveSetup(scenarioId, language, voice);

      const goToRaw = str(args.goTo).toLowerCase();
      const goTo =
        goToRaw === "practice" && language && voice
          ? "practice"
          : "setup";
      const path = `/scenarios/${scenarioId}/${goTo}`;
      ctx.navigate(path);

      const langLabel = detail.languages.find((l) => l.code === language)?.label ?? language;
      const voiceMeta = detail.voices.find((v) => v.id === voice);

      return {
        ok: true,
        scenarioId,
        title: detail.title,
        language,
        languageLabel: langLabel,
        voice,
        voiceTone: voiceMeta?.tone ?? null,
        path,
        canPractice: detail.canPractice,
        note:
          goTo === "practice"
            ? "Saved setup and opened practice."
            : "Saved setup and opened the setup page (user can preview voices there).",
      };
    }

    case "create_scenario": {
      const title = str(args.title);
      const participantName = str(args.participantName);
      if (!title || !participantName) {
        return { ok: false, error: "title and participantName are required" };
      }
      const situation =
        str(args.situation) || str(args.description) || `Practice conversation: ${title}`;
      const description = str(args.description) || situation;
      const gender =
        str(args.participantGender).toLowerCase() === "female" ? "female" : "male";
      const role = str(args.participantRole) || "Conversation partner";
      const greeting = str(args.greeting) || `Hi, thanks for joining — I'm ${participantName}.`;
      const objectives = parseObjectives(str(args.objectives));

      const created = await api<{
        id: string;
        title: string;
        availability: string;
      }>("/scenarios/mine", {
        method: "POST",
        token: ctx.token,
        body: JSON.stringify({
          title,
          description,
          level: "beginner",
          estDurationMin: 15,
          practiceCallMin: 5,
          points: 100,
          passMark: 70,
          availability: "live",
          defaultLanguage: "en-IN",
          defaultVoice: gender === "female" ? "Aoede" : "Charon",
          languages: ["en-IN"],
          voices: [gender === "female" ? "Aoede" : "Charon"],
          learn: {
            situation,
            greeting,
            participant: {
              name: participantName,
              role,
              tone: "Friendly and professional",
              agenda: situation,
              gender,
            },
            objectives: objectives.length ? objectives : ["Have a clear, useful practice conversation"],
            whatGoodLooksLike: ["Stay on topic", "Ask clarifying questions", "Close with a next step"],
          },
          watch: {
            turns: [
              { speaker: participantName, text: greeting },
              { speaker: "You", text: "Thanks — happy to practice with you." },
            ],
          },
        }),
      });

      return {
        ok: true,
        scenarioId: created.id,
        title: created.title,
        availability: created.availability,
        hint: "Offer to start practice or open My Scenarios.",
      };
    }

    case "read_report": {
      let sessionId = str(args.sessionId);
      if (!sessionId) {
        const list = await api<{
          sessions: { id: string; status: string; score: { overall: number } | null }[];
        }>("/sessions", { token: ctx.token });
        const completed =
          list.sessions.find((s) => s.status === "completed" && s.score) ||
          list.sessions.find((s) => s.status === "completed") ||
          list.sessions[0];
        if (!completed) return { ok: false, error: "No practice sessions found yet" };
        sessionId = completed.id;
      }

      const detail = await api<{
        id: string;
        status: string;
        scenarioTitle?: string;
        language?: string;
        score?: {
          overall: number;
          passed: boolean;
          strengths?: string[];
          improvements?: string[];
          coachNotes?: string;
        } | null;
      }>(`/sessions/${sessionId}`, { token: ctx.token });

      const score = detail.score;
      return {
        ok: true,
        sessionId: detail.id,
        status: detail.status,
        scenarioTitle: detail.scenarioTitle ?? null,
        language: detail.language ?? null,
        overall: score?.overall ?? null,
        passed: score?.passed ?? null,
        coachNotes: score?.coachNotes ?? null,
        strengths: score?.strengths ?? [],
        improvements: score?.improvements ?? [],
      };
    }

    case "my_progress": {
      const [tracksRes, scenariosRes, mineRes] = await Promise.all([
        api<{ tracks: { id: string; title: string; scenarioCount: number }[] }>(
          "/tracks?includePersonal=1",
          { token: ctx.token },
        ),
        api<{
          scenarios: {
            id: string;
            title: string;
            trackTitle: string;
            status: string;
            latestScore: { overall: number; passed: boolean } | null;
          }[];
        }>("/scenarios", { token: ctx.token }),
        api<{
          scenarios: {
            id: string;
            title: string;
            trackTitle: string;
            status: string;
            latestScore: { overall: number; passed: boolean } | null;
          }[];
        }>("/scenarios/mine", { token: ctx.token }),
      ]);

      const scenarios = [...scenariosRes.scenarios, ...mineRes.scenarios];
      const completed = scenarios.filter((s) => s.status === "completed");
      const passed = completed.filter((s) => s.latestScore?.passed);
      const scores = completed
        .map((s) => s.latestScore?.overall)
        .filter((n): n is number => typeof n === "number");
      const avg =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      return {
        ok: true,
        tracks: tracksRes.tracks.map((t) => ({ id: t.id, title: t.title, count: t.scenarioCount })),
        totalScenarios: scenarios.length,
        completed: completed.length,
        passed: passed.length,
        averageScore: avg,
        recent: completed.slice(0, 5).map((s) => ({
          id: s.id,
          title: s.title,
          track: s.trackTitle,
          score: s.latestScore?.overall ?? null,
          passed: s.latestScore?.passed ?? null,
        })),
      };
    }

    case "view_history": {
      const limit =
        typeof args.limit === "number"
          ? args.limit
          : typeof args.limit === "string"
            ? Number(args.limit)
            : 20;
      const turns = getLumiHistoryForTool(ctx.userId, limit);
      return { ok: true, count: turns.length, turns };
    }

    case "sleep": {
      return {
        ok: true,
        __endSession: true,
        reason: str(args.reason) || "sleep",
      };
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
