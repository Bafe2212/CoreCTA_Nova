import { Ear, EarOff, Volume2, VolumeX } from "lucide-react";
import { ORB_LABELS, ORB_STATES, ORB_THEMES, type OrbState } from "@/lib/nova";
import { useProviders } from "@/hooks/useNovaData";

export interface SpeechBridge {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  setEnabled: (v: boolean) => void;
  test: () => void;
}

export interface VoiceBridge {
  supported: boolean;
  wakeEnabled: boolean;
  wakeActive: boolean;
  setWakeEnabled: (v: boolean) => void;
}

export interface SessionBridge {
  openCount: number;
  reset: () => void;
}

export interface LlmBridge {
  provider: string;
  model: string;
  setProvider: (p: string) => void;
  setModel: (m: string) => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-6 first:mt-0">
    <p className="font-heading text-[13px] tracking-[0.16em] text-muted-foreground uppercase">
      {title}
    </p>
    <div className="mt-3">{children}</div>
  </div>
);

const Chip = ({
  active,
  disabled,
  color,
  onClick,
  testid,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  color?: string;
  onClick: () => void;
  testid: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    data-testid={testid}
    disabled={disabled}
    onClick={onClick}
    className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11.5px] transition-colors duration-300 disabled:opacity-35"
    style={{
      borderColor: active ? (color ?? "rgba(34,211,238,0.45)") : "rgba(148,163,184,0.14)",
      color: active ? (color ?? "#67e8f9") : "rgba(148,163,184,0.8)",
    }}
  >
    {children}
  </button>
);

export default function SettingsApp({
  orbState,
  setOrbState,
  speech,
  voice,
  session,
  llm,
}: {
  orbState: OrbState;
  setOrbState: (s: OrbState) => void;
  speech: SpeechBridge;
  voice: VoiceBridge;
  session: SessionBridge;
  llm: LlmBridge;
}) {
  const providers = useProviders();
  const list = providers.data?.providers ?? [];
  const current = list.find((p) => p.id === llm.provider) ?? list[0];

  return (
    <div className="h-full overflow-auto px-5 py-4 text-[13.5px] text-foreground/85">
      <Section title="KI-Anbieter">
        <div className="flex flex-wrap gap-2">
          {list.map((p) => (
            <Chip
              key={p.id}
              testid={`settings-provider-${p.id}`}
              active={llm.provider === p.id}
              disabled={!p.configured}
              onClick={() => {
                llm.setProvider(p.id);
                llm.setModel(p.models[0]);
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: p.configured ? "#22d3ee" : "rgba(148,163,184,0.5)" }}
              />
              {p.label}
            </Chip>
          ))}
          {list.length === 0 && (
            <p className="font-mono text-[11px] text-muted-foreground/60">Lade Anbieter …</p>
          )}
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground/55">
          Nicht wählbare Anbieter brauchen ihren Key in backend/.env (GEMINI_API_KEY, ZHIPUAI_API_KEY).
        </p>

        {current && (
          <div className="mt-4 flex flex-wrap gap-2" data-testid="settings-models">
            {current.models.map((m) => (
              <Chip
                key={m}
                testid={`settings-model-${m}`}
                active={llm.model === m}
                onClick={() => llm.setModel(m)}
              >
                <span className="font-mono text-[10.5px]">{m}</span>
              </Chip>
            ))}
          </div>
        )}
      </Section>

      <Section title="Stimme">
        <div className="flex items-center gap-3">
          <Chip
            testid="settings-speech-toggle"
            active={speech.enabled}
            disabled={!speech.supported}
            onClick={() => speech.setEnabled(!speech.enabled)}
          >
            {speech.enabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            {speech.enabled ? "Antworten vorlesen" : "Stumm"}
          </Chip>
          <button
            type="button"
            data-testid="settings-speech-test"
            onClick={speech.test}
            disabled={!speech.supported || !speech.enabled}
            className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-cyan-200 disabled:opacity-40"
          >
            Probe hören
          </button>
        </div>
      </Section>

      <Section title="Weckwort">
        <div className="flex items-center gap-3">
          <Chip
            testid="settings-wake-toggle"
            active={voice.wakeEnabled}
            disabled={!voice.supported}
            onClick={() => voice.setWakeEnabled(!voice.wakeEnabled)}
          >
            {voice.wakeEnabled ? <Ear className="size-3.5" /> : <EarOff className="size-3.5" />}
            {voice.wakeEnabled ? "„Hey NOVA“ aktiv" : "Weckwort aus"}
          </Chip>
          <span className="font-mono text-[10.5px] text-muted-foreground/60">
            {voice.wakeEnabled
              ? voice.wakeActive
                ? "wartet im Hintergrund"
                : "kurz unterbrochen"
              : "Orb antippen genügt"}
          </span>
        </div>
      </Section>

      <Section title="Orb-Zustand">
        <div className="flex flex-wrap gap-2">
          {ORB_STATES.map((s) => (
            <Chip
              key={s}
              testid={`settings-orb-state-${s}`}
              active={orbState === s}
              color={ORB_THEMES[s].primary}
              onClick={() => setOrbState(s)}
            >
              <span className="size-1.5 rounded-full" style={{ background: ORB_THEMES[s].primary }} />
              {ORB_LABELS[s]}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Sitzung">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground/70">
            {session.openCount} Fenster werden beim nächsten Start wiederhergestellt
          </span>
          <button
            type="button"
            data-testid="settings-session-reset"
            onClick={session.reset}
            className="font-mono text-[11px] text-muted-foreground/70 transition-colors duration-200 hover:text-cyan-200"
          >
            Layout zurücksetzen
          </button>
        </div>
      </Section>
    </div>
  );
}
