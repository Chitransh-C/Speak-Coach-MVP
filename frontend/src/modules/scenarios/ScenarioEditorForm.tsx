/**
 * Admin-only global scenario editor (catalog Track → Scenario).
 * Learner personal create uses PersonalScenarioForm instead.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import {
  emptyLearnForm,
  learnFromForm,
  learnToForm,
  slugifyScenarioId,
  type LearnForm,
} from "./scenarioFormShared";

export type { LearnForm };
export { learnToForm, learnFromForm, emptyLearnForm, slugifyScenarioId };

export type AdminScenarioFormValues = {
  id: string;
  trackId: string;
  title: string;
  description: string;
  level: string;
  estDurationMin: number;
  practiceCallMin: number;
  points: number;
  passMark: number;
  availability: "live" | "coming_soon";
  defaultLanguage: string;
  defaultVoice: string;
  watchJson: string;
};

export function emptyAdminScenarioForm(
  defaults?: Partial<AdminScenarioFormValues>,
): AdminScenarioFormValues {
  return {
    id: "",
    trackId: "",
    title: "",
    description: "",
    level: "beginner",
    estDurationMin: 15,
    practiceCallMin: 5,
    points: 100,
    passMark: 70,
    availability: "coming_soon",
    defaultLanguage: "en-IN",
    defaultVoice: "Charon",
    watchJson: JSON.stringify(
      { turns: [{ speaker: "Partner", text: "Thanks for joining — shall we begin?" }] },
      null,
      2,
    ),
    ...defaults,
  };
}

/** @deprecated use emptyAdminScenarioForm */
export const emptyScenarioForm = emptyAdminScenarioForm;
/** @deprecated */
export type ScenarioEditorValues = AdminScenarioFormValues;

type TrackOption = { id: string; title: string };

type Props = {
  isNew: boolean;
  initialForm?: AdminScenarioFormValues;
  initialLearn?: LearnForm;
  tracks: TrackOption[];
  submitLabel?: string;
  headerActions?: ReactNode;
  onSubmit: (payload: {
    form: AdminScenarioFormValues;
    learn: LearnForm;
    watch: Record<string, unknown>;
    body: Record<string, unknown>;
  }) => Promise<void>;
  onTogglePublish?: (next: "live" | "coming_soon") => Promise<void>;
};

export function ScenarioEditorForm({
  isNew,
  initialForm,
  initialLearn,
  tracks,
  submitLabel,
  headerActions,
  onSubmit,
  onTogglePublish,
}: Props) {
  const { token } = useAuth();
  const [idManual, setIdManual] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<AdminScenarioFormValues>(
    initialForm ?? emptyAdminScenarioForm(),
  );
  const [learn, setLearn] = useState<LearnForm>(initialLearn ?? emptyLearnForm());
  const [locales, setLocales] = useState<{
    languages: { code: string; label: string }[];
    voices: { id: string; label: string; gender: string; tone?: string }[];
  } | null>(null);

  // Catalog tracks only — never offer "personal"
  const catalogTracks = useMemo(
    () => tracks.filter((t) => t.id !== "personal"),
    [tracks],
  );

  useEffect(() => {
    api<{
      languages: { code: string; label: string }[];
      voices: { id: string; label: string; gender: string; tone?: string }[];
    }>("/locales", { token })
      .then(setLocales)
      .catch(() => setLocales(null));
  }, [token]);

  useEffect(() => {
    if (!initialForm) return;
    setForm(initialForm);
    setIdManual(true);
  }, [initialForm]);

  useEffect(() => {
    if (!initialLearn) return;
    setLearn(initialLearn);
  }, [initialLearn]);

  useEffect(() => {
    if (!catalogTracks.length) return;
    setForm((f) => (f.trackId ? f : { ...f, trackId: catalogTracks[0].id }));
  }, [catalogTracks]);

  const voicesForGender = useMemo(() => {
    const all = locales?.voices ?? [];
    return all.filter((v) => v.gender === learn.participantGender);
  }, [locales, learn.participantGender]);

  useEffect(() => {
    if (!voicesForGender.length) return;
    if (voicesForGender.some((v) => v.id === form.defaultVoice)) return;
    setForm((f) => ({ ...f, defaultVoice: voicesForGender[0].id }));
  }, [voicesForGender, form.defaultVoice]);

  function setTitle(title: string) {
    setForm((f) => ({
      ...f,
      title,
      id: isNew && !idManual ? slugifyScenarioId(title) : f.id,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!form.id.trim()) {
      setMsg("Scenario id is required (e.g. scenario-discovery-call)");
      return;
    }
    if (!/^[a-z0-9-]+$/i.test(form.id.trim())) {
      setMsg("Id must be letters, numbers, and hyphens only");
      return;
    }
    if (!form.trackId || form.trackId === "personal") {
      setMsg("Select a catalog track (Interviews or Sales)");
      return;
    }
    if (!learn.participantName.trim() || !learn.situation.trim()) {
      setMsg("Participant name and situation are required");
      return;
    }
    let watch: Record<string, unknown>;
    try {
      watch = JSON.parse(form.watchJson) as Record<string, unknown>;
    } catch {
      setMsg("Watch JSON is invalid");
      return;
    }
    const body: Record<string, unknown> = {
      id: form.id.trim(),
      trackId: form.trackId,
      title: form.title.trim(),
      description: form.description.trim(),
      level: form.level,
      estDurationMin: form.estDurationMin,
      practiceCallMin: form.practiceCallMin,
      points: form.points,
      passMark: form.passMark,
      availability: form.availability,
      defaultLanguage: form.defaultLanguage,
      defaultVoice: form.defaultVoice,
      languages: [form.defaultLanguage],
      voices: [form.defaultVoice],
      learn: learnFromForm(learn),
      watch,
    };
    setSaving(true);
    try {
      await onSubmit({ form, learn, watch, body });
    } catch (err) {
      setMsg(err instanceof HttpError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-md">
      {headerActions}
      {msg && <div className="error-banner">{msg}</div>}

      <form className="stack-md" onSubmit={(e) => void handleSubmit(e)}>
        <section className="panel stack-sm">
          <h2>Basics</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Global catalog scenario — assigned to a track (Interviews / Sales). Not for personal
            learner scenarios.
          </p>
          <label className="muted">Title</label>
          <input
            className="toolbar-input"
            value={form.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sales Discovery: Uncover the Pain"
            required
          />
          {isNew && (
            <>
              <label className="muted">Id (URL / DB key)</label>
              <input
                className="toolbar-input"
                value={form.id}
                onChange={(e) => {
                  setIdManual(true);
                  setForm({ ...form, id: e.target.value });
                }}
                placeholder="scenario-sales-discovery"
                required
              />
            </>
          )}
          <label className="muted">Track</label>
          <select
            className="toolbar-select"
            value={form.trackId}
            onChange={(e) => setForm({ ...form, trackId: e.target.value })}
            required
          >
            <option value="" disabled>
              Select catalog track…
            </option>
            {catalogTracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <label className="muted">Description</label>
          <textarea
            className="toolbar-input"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            required
          />
          <div className="admin-toolbar">
            <select
              className="toolbar-select"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
            <label className="muted" style={{ alignSelf: "center" }}>
              Call min
            </label>
            <input
              className="toolbar-input"
              type="number"
              min={3}
              max={25}
              value={form.practiceCallMin}
              onChange={(e) => setForm({ ...form, practiceCallMin: Number(e.target.value) })}
            />
            <label className="muted" style={{ alignSelf: "center" }}>
              Est. min
            </label>
            <input
              className="toolbar-input"
              type="number"
              min={1}
              max={120}
              value={form.estDurationMin}
              onChange={(e) => setForm({ ...form, estDurationMin: Number(e.target.value) })}
            />
            <label className="muted" style={{ alignSelf: "center" }}>
              Pass
            </label>
            <input
              className="toolbar-input"
              type="number"
              min={0}
              max={100}
              value={form.passMark}
              onChange={(e) => setForm({ ...form, passMark: Number(e.target.value) })}
            />
            <select
              className="toolbar-select"
              value={form.availability}
              onChange={(e) =>
                setForm({
                  ...form,
                  availability: e.target.value === "live" ? "live" : "coming_soon",
                })
              }
            >
              <option value="coming_soon">coming_soon</option>
              <option value="live">live</option>
            </select>
          </div>
          <div className="admin-toolbar">
            <select
              className="toolbar-select"
              value={form.defaultLanguage}
              onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
            >
              {(locales?.languages ?? [{ code: "en-IN", label: "English (India)" }]).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label} ({l.code})
                </option>
              ))}
            </select>
            <select
              className="toolbar-select"
              value={form.defaultVoice}
              onChange={(e) => setForm({ ...form, defaultVoice: e.target.value })}
            >
              {voicesForGender.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.tone ? ` · ${v.tone}` : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="panel stack-sm">
          <h2>AI partner (Learn)</h2>
          <label className="muted">Situation</label>
          <textarea
            className="toolbar-input"
            value={learn.situation}
            onChange={(e) => setLearn({ ...learn, situation: e.target.value })}
            rows={3}
            required
            placeholder="What is this practice call about?"
          />
          <div className="admin-toolbar">
            <input
              className="toolbar-input"
              placeholder="Participant name"
              value={learn.participantName}
              onChange={(e) => setLearn({ ...learn, participantName: e.target.value })}
              required
            />
            <input
              className="toolbar-input"
              placeholder="Role"
              value={learn.participantRole}
              onChange={(e) => setLearn({ ...learn, participantRole: e.target.value })}
            />
            <select
              className="toolbar-select"
              value={learn.participantGender}
              onChange={(e) =>
                setLearn({
                  ...learn,
                  participantGender: e.target.value === "female" ? "female" : "male",
                })
              }
            >
              <option value="male">male</option>
              <option value="female">female</option>
            </select>
          </div>
          <input
            className="toolbar-input"
            placeholder="Tone (e.g. Busy, skeptical but fair)"
            value={learn.participantTone}
            onChange={(e) => setLearn({ ...learn, participantTone: e.target.value })}
          />
          <input
            className="toolbar-input"
            placeholder="Agenda"
            value={learn.participantAgenda}
            onChange={(e) => setLearn({ ...learn, participantAgenda: e.target.value })}
          />
          <input
            className="toolbar-input"
            placeholder="Greeting line"
            value={learn.greeting}
            onChange={(e) => setLearn({ ...learn, greeting: e.target.value })}
          />
          <label className="muted">Objectives (one per line)</label>
          <textarea
            className="toolbar-input"
            value={learn.objectivesText}
            onChange={(e) => setLearn({ ...learn, objectivesText: e.target.value })}
            rows={4}
            placeholder={"Uncover at least one concrete pain\nClose with a clear next step"}
          />
          <label className="muted">What good looks like (one per line)</label>
          <textarea
            className="toolbar-input"
            value={learn.goodLooksText}
            onChange={(e) => setLearn({ ...learn, goodLooksText: e.target.value })}
            rows={4}
          />
        </section>

        <section className="panel stack-sm">
          <h2>Watch sample (JSON)</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Optional model dialogue shown before practice. Shape:{" "}
            <code>{`{ "turns": [{ "speaker", "text" }] }`}</code>
          </p>
          <textarea
            className="toolbar-input admin-code"
            value={form.watchJson}
            onChange={(e) => setForm({ ...form, watchJson: e.target.value })}
            rows={8}
          />
        </section>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : submitLabel ?? (isNew ? "Create catalog scenario" : "Save changes")}
          </button>
          {!isNew && onTogglePublish && (
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                const next = form.availability === "live" ? "coming_soon" : "live";
                void onTogglePublish(next)
                  .then(() => setForm((f) => ({ ...f, availability: next })))
                  .catch((err) =>
                    setMsg(err instanceof HttpError ? err.message : "Publish failed"),
                  );
              }}
            >
              {form.availability === "live" ? "Unpublish" : "Publish live"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
