/**
 * Learner personal scenario create/edit — always under Track `personal`.
 * Separate from admin catalog ScenarioEditorForm.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import {
  PERSONAL_TRACK_ID,
  PERSONAL_TRACK_TITLE,
  emptyLearnForm,
  learnFromForm,
  type LearnForm,
} from "./scenarioFormShared";

export type PersonalScenarioFormValues = {
  title: string;
  description: string;
  level: string;
  estDurationMin: number;
  practiceCallMin: number;
  passMark: number;
  availability: "live" | "coming_soon";
  defaultLanguage: string;
  defaultVoice: string;
  watchJson: string;
};

export function emptyPersonalScenarioForm(
  defaults?: Partial<PersonalScenarioFormValues>,
): PersonalScenarioFormValues {
  return {
    title: "",
    description: "",
    level: "beginner",
    estDurationMin: 15,
    practiceCallMin: 5,
    passMark: 70,
    availability: "live",
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

type Props = {
  isNew: boolean;
  initialForm?: PersonalScenarioFormValues;
  initialLearn?: LearnForm;
  submitLabel?: string;
  headerActions?: ReactNode;
  onSubmit: (payload: {
    form: PersonalScenarioFormValues;
    learn: LearnForm;
    watch: Record<string, unknown>;
    body: Record<string, unknown>;
  }) => Promise<void>;
  onTogglePublish?: (next: "live" | "coming_soon") => Promise<void>;
};

export function PersonalScenarioForm({
  isNew,
  initialForm,
  initialLearn,
  submitLabel,
  headerActions,
  onSubmit,
  onTogglePublish,
}: Props) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState<PersonalScenarioFormValues>(
    initialForm ?? emptyPersonalScenarioForm(),
  );
  const [learn, setLearn] = useState<LearnForm>(initialLearn ?? emptyLearnForm());
  const [locales, setLocales] = useState<{
    languages: { code: string; label: string }[];
    voices: { id: string; label: string; gender: string; tone?: string }[];
  } | null>(null);

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
  }, [initialForm]);

  useEffect(() => {
    if (!initialLearn) return;
    setLearn(initialLearn);
  }, [initialLearn]);

  const voicesForGender = useMemo(() => {
    const all = locales?.voices ?? [];
    return all.filter((v) => v.gender === learn.participantGender);
  }, [locales, learn.participantGender]);

  useEffect(() => {
    if (!voicesForGender.length) return;
    if (voicesForGender.some((v) => v.id === form.defaultVoice)) return;
    setForm((f) => ({ ...f, defaultVoice: voicesForGender[0].id }));
  }, [voicesForGender, form.defaultVoice]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
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
      title: form.title.trim(),
      description: form.description.trim(),
      level: form.level,
      estDurationMin: form.estDurationMin,
      practiceCallMin: form.practiceCallMin,
      points: 100,
      passMark: form.passMark,
      availability: form.availability,
      defaultLanguage: form.defaultLanguage,
      defaultVoice: form.defaultVoice,
      languages: [form.defaultLanguage],
      voices: [form.defaultVoice],
      learn: learnFromForm(learn),
      watch,
      // Server forces track=personal; included for clarity in hierarchy.
      trackId: PERSONAL_TRACK_ID,
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
          <label className="muted">Track</label>
          <input
            className="toolbar-input"
            value={`${PERSONAL_TRACK_TITLE} (private to you)`}
            disabled
            readOnly
          />
          <label className="muted">Title</label>
          <input
            className="toolbar-input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Pitch practice with a skeptical buyer"
            required
          />
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
              <option value="live">live</option>
              <option value="coming_soon">coming_soon</option>
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
          <h2>AI partner</h2>
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
            placeholder="Tone"
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
            rows={3}
          />
          <label className="muted">What good looks like (one per line)</label>
          <textarea
            className="toolbar-input"
            value={learn.goodLooksText}
            onChange={(e) => setLearn({ ...learn, goodLooksText: e.target.value })}
            rows={3}
          />
        </section>

        <section className="panel stack-sm">
          <h2>Watch sample (JSON)</h2>
          <textarea
            className="toolbar-input admin-code"
            value={form.watchJson}
            onChange={(e) => setForm({ ...form, watchJson: e.target.value })}
            rows={6}
          />
        </section>

        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving
              ? "Saving…"
              : submitLabel ?? (isNew ? "Create personal scenario" : "Save changes")}
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
                    setMsg(err instanceof HttpError ? err.message : "Update failed"),
                  );
              }}
            >
              {form.availability === "live" ? "Set draft" : "Set live"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
