"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Link2,
  LockKeyhole,
  MessageSquare,
  Plus,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  WholeWord,
} from "lucide-react";
import {
  DECKS,
  parseCustomDeck,
  type DeckKind,
  type RoomConfig,
} from "@/lib/decks";
import type { AccessMode } from "@/lib/crypto";
import { Brand } from "./brand";
import { Privacy } from "./privacy";

export type CreateOptions = {
  name: string;
  config: RoomConfig;
  ttlHours: number;
  accessMode: AccessMode;
  requireApproval: boolean;
};
type FieldErrors = Partial<
  Record<"name" | "roomName" | "custom" | "code" | "form", string>
>;
const steps = ["Room", "Cards", "Invite"];

export function Landing({
  configured,
  invite,
  onCreate,
  onJoin,
  onPractice,
}: {
  configured: boolean;
  invite: string;
  onCreate: (options: CreateOptions) => Promise<void>;
  onJoin: (code: string, name: string, observer: boolean) => Promise<void>;
  onPractice: () => void;
}) {
  const [tab, setTab] = useState<"create" | "join">(invite ? "join" : "create");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("Sprint planning");
  const [deck, setDeck] = useState<DeckKind>("fibonacci");
  const [custom, setCustom] = useState("1, 2, 3, 5, 8, ?");
  const [accessMode, setAccessMode] = useState<AccessMode>("link");
  const [requireApproval, setRequireApproval] = useState(true);
  const [ttlHours, setTtlHours] = useState(2);
  const [code, setCode] = useState(invite);
  const [observer, setObserver] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const cards =
    deck === "custom"
      ? custom
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .slice(0, 16)
      : DECKS[deck].cards;

  useEffect(() => {
    if (focusHeading.current) {
      heading.current?.focus();
      focusHeading.current = false;
    }
  }, [step, tab]);

  function changeStep(next: number) {
    focusHeading.current = true;
    setErrors({});
    setStep(next);
  }
  function changeTab(next: "create" | "join", focusContent = false) {
    focusHeading.current = focusContent;
    setErrors({});
    setTab(next);
    if (focusContent && tab === next) heading.current?.focus();
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "create"
        : event.key === "End"
          ? "join"
          : tab === "create"
            ? "join"
            : "create";
    changeTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  }
  function invalid(next: FieldErrors) {
    setErrors(next);
    const first = Object.keys(next)[0];
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(),
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const next: FieldErrors = {};
    if (tab === "join" || step === 0) {
      if (!name.trim() || name.trim().length > 32)
        next.name = "Enter a display name of 1–32 characters.";
    }
    if (tab === "create" && step === 0 && !roomName.trim())
      next.roomName = "Give your room a name.";
    if (tab === "join" && !code.trim())
      next.code = "Paste an invitation link or enter all 12 words.";
    if (tab === "create" && step === 1 && deck === "custom") {
      try {
        parseCustomDeck(custom);
      } catch (err) {
        next.custom = (err as Error).message;
      }
    }
    if (Object.keys(next).length) return invalid(next);
    if (tab === "create" && step < 2) return changeStep(step + 1);
    if (!configured) return;
    setErrors({});
    setBusy(true);
    try {
      if (tab === "join") await onJoin(code, name.trim(), observer);
      else
        await onCreate({
          name: name.trim(),
          config: {
            name: roomName.trim(),
            deck,
            cards:
              deck === "custom"
                ? parseCustomDeck(custom)
                : [...DECKS[deck].cards],
          },
          ttlHours,
          accessMode,
          requireApproval,
        });
    } catch (err) {
      setErrors({
        form:
          err instanceof Error
            ? err.message
            : "We couldn’t open the room. Your details are still here; try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  const nameField = (
    <label htmlFor="display-name">
      <span id="display-name-label">Your name</span>
      <input
        id="display-name"
        aria-labelledby="display-name-label"
        name="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Alex"
        maxLength={32}
        autoComplete="off"
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? "name-error" : undefined}
        required
      />
      {errors.name && (
        <span className="field-error" id="name-error">
          {errors.name}
        </span>
      )}
    </label>
  );
  return (
    <div className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <button onClick={() => setPrivacy(true)}>
            <ShieldCheck size={18} /> End-to-end encrypted
          </button>
          <button
            className="header-join"
            onClick={() => changeTab("join", true)}
          >
            Join a room <ArrowRight size={17} />
          </button>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="status-dot" /> LESS GUESSWORK. MORE TEAMWORK.
            </div>
            <h1>
              Good estimates start
              <br />
              with <span>everyone.</span>
              <svg viewBox="0 0 290 15" aria-hidden="true">
                <path d="M4 10 Q130 -3 285 8 M34 14 Q150 4 245 12" />
              </svg>
            </h1>
            <p>
              A little space to think, a moment to reveal.
              <br />
              Bring your team together and find your next number.
            </p>
            <div className="hero-details">
              <span>
                <Check size={17} /> No sign-up
              </span>
              <span>
                <Check size={17} /> Live voting
              </span>
              <span>
                <LockKeyhole size={17} /> E2EE
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-note">
              <Sparkles size={16} /> Different perspectives. Shared
              understanding.
            </div>
            <div className="floating-label label-top">
              <span className="mini-avatar lilac">J</span> I’m thinking a 5.
            </div>
            <div className="illustration-cards">
              <div className="illustration-card card-one">
                <span>3</span>
                <strong>3</strong>
                <span>3</span>
              </div>
              <div className="illustration-card card-two">
                <span>5</span>
                <strong>
                  5<span className="card-spark">✳</span>
                </strong>
                <span>5</span>
              </div>
              <div className="illustration-card card-three">
                <span>8</span>
                <strong>8</strong>
                <span>8</span>
              </div>
            </div>
            <div className="floating-label label-bottom">
              <span className="mini-avatar mint">A</span> Let’s talk it through{" "}
              <MessageSquare size={16} />
            </div>
            <span className="art-asterisk">✳</span>
            <span className="art-dot" />
          </div>
        </section>
        <section
          className="start-layout"
          id="room-form"
          aria-label="Start a session"
        >
          <div className="setup-card">
            <div className="tabs" role="tablist" aria-label="Room action">
              {(["create", "join"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  id={`${value}-tab`}
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls="room-panel"
                  tabIndex={tab === value ? 0 : -1}
                  className={tab === value ? "active" : ""}
                  onClick={() => changeTab(value)}
                  onKeyDown={tabKey}
                >
                  {value === "create" ? (
                    <Plus size={19} />
                  ) : (
                    <Users size={19} />
                  )}
                  {value === "create" ? "Create a room" : "Join a room"}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="room-panel" aria-labelledby={`${tab}-tab`}>
              <form
                ref={form}
                onSubmit={submit}
                className="setup-form"
                noValidate
                aria-busy={busy}
              >
                {tab === "create" && (
                  <ol className="wizard-progress" aria-label="Creation steps">
                    {steps.map((label, index) => (
                      <li
                        key={label}
                        aria-current={index === step ? "step" : undefined}
                        className={index <= step ? "reached" : ""}
                      >
                        <span aria-hidden="true">
                          {index < step ? <Check size={15} /> : index + 1}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="form-title">
                  <p className="step-caption">
                    {tab === "create"
                      ? `Step ${step + 1} of 3`
                      : "Join your team"}
                  </p>
                  <h2 ref={heading} tabIndex={-1}>
                    {tab === "join"
                      ? "Your team is waiting."
                      : [
                          "Name your room.",
                          "Choose your cards.",
                          "Invite your team.",
                        ][step]}
                  </h2>
                  <p>
                    {tab === "join"
                      ? "Use your invitation and a display name. No account needed."
                      : [
                          "Start with a name for you and your room.",
                          "Pick how your team estimates. Story points are a good starting point.",
                          "Share a private invitation when your room is ready.",
                        ][step]}
                  </p>
                </div>
                <div className="wizard-fields">
                  {tab === "join" ? (
                    <>
                      {nameField}
                      <label htmlFor="invitation">
                        <span id="invitation-label">
                          Invitation link or passphrase
                        </span>
                        <textarea
                          id="invitation"
                          aria-labelledby="invitation-label"
                          name="code"
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          placeholder="Paste your invitation here"
                          rows={3}
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={!!errors.code}
                          aria-describedby={
                            errors.code ? "code-error" : "code-help"
                          }
                          required
                        />
                        <small id="code-help">
                          You can paste the full link or all 12 words.
                        </small>
                        {errors.code && (
                          <span className="field-error" id="code-error">
                            {errors.code}
                          </span>
                        )}
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={observer}
                          onChange={(event) =>
                            setObserver(event.target.checked)
                          }
                        />
                        <span>
                          <strong>Join as an observer</strong>
                          <small>Follow along without voting.</small>
                        </span>
                        <Eye size={20} />
                      </label>
                    </>
                  ) : step === 0 ? (
                    <>
                      {nameField}
                      <label htmlFor="room-name">
                        <span id="room-name-label">Room name</span>
                        <input
                          id="room-name"
                          aria-labelledby="room-name-label"
                          name="roomName"
                          value={roomName}
                          onChange={(event) => setRoomName(event.target.value)}
                          maxLength={80}
                          autoComplete="off"
                          aria-invalid={!!errors.roomName}
                          aria-describedby={
                            errors.roomName ? "roomName-error" : undefined
                          }
                          required
                        />
                        {errors.roomName && (
                          <span className="field-error" id="roomName-error">
                            {errors.roomName}
                          </span>
                        )}
                      </label>
                    </>
                  ) : step === 1 ? (
                    <>
                      <fieldset>
                        <legend>Card deck</legend>
                        <div className="deck-options">
                          {(
                            [
                              "fibonacci",
                              "tshirt",
                              "hours",
                              "custom",
                            ] as DeckKind[]
                          ).map((kind) => (
                            <label
                              key={kind}
                              className={`deck-option ${deck === kind ? "selected" : ""}`}
                            >
                              <input
                                className="option-input"
                                type="radio"
                                name="deck"
                                value={kind}
                                checked={deck === kind}
                                onChange={() => setDeck(kind)}
                              />
                              <span className="deck-symbol" aria-hidden="true">
                                {kind === "fibonacci" ? (
                                  "1, 2, 3"
                                ) : kind === "tshirt" ? (
                                  "S M L"
                                ) : kind === "hours" ? (
                                  <Timer size={23} />
                                ) : (
                                  <Plus size={23} />
                                )}
                              </span>
                              <span>
                                {kind === "custom"
                                  ? "Custom"
                                  : DECKS[kind].name}
                              </span>
                              {deck === kind && (
                                <Check size={15} className="option-check" />
                              )}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {deck === "custom" && (
                        <label htmlFor="custom-cards">
                          <span id="custom-cards-label">Card values</span>
                          <input
                            id="custom-cards"
                            aria-labelledby="custom-cards-label"
                            name="custom"
                            value={custom}
                            onChange={(event) => setCustom(event.target.value)}
                            placeholder="1, 2, 3, 5, 8, ?"
                            maxLength={160}
                            aria-describedby={
                              errors.custom
                                ? "custom-error custom-help"
                                : "custom-help"
                            }
                            aria-invalid={!!errors.custom}
                          />
                          <small id="custom-help">
                            2–16 different values, separated by commas. Up to 8
                            characters each.
                          </small>
                          {errors.custom && (
                            <span className="field-error" id="custom-error">
                              {errors.custom}
                            </span>
                          )}
                        </label>
                      )}
                      <div className="deck-preview">
                        <p>In your deck</p>
                        <div
                          className="mini-deck"
                          aria-label="Selected card values"
                        >
                          {cards.map((card, index) => (
                            <span key={`${index}-${card}`}>
                              {card.slice(0, 8)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="creation-review">
                        <strong>{roomName}</strong>
                        <span>
                          {deck === "custom" ? "Custom deck" : DECKS[deck].name}{" "}
                          · Hosted by {name}
                        </span>
                      </div>
                      <fieldset>
                        <legend>How will you invite people?</legend>
                        <div className="access-options">
                          {(["link", "passphrase"] as const).map((mode) => (
                            <label
                              key={mode}
                              className={accessMode === mode ? "selected" : ""}
                            >
                              <input
                                className="option-input"
                                type="radio"
                                name="access"
                                value={mode}
                                checked={accessMode === mode}
                                onChange={() => setAccessMode(mode)}
                              />
                              {mode === "link" ? (
                                <Link2 size={20} />
                              ) : (
                                <WholeWord size={20} />
                              )}
                              <span>
                                <strong>
                                  {mode === "link"
                                    ? "Invite link"
                                    : "Passphrase"}
                                </strong>
                                <small>
                                  {mode === "link"
                                    ? "Copy and share a private link"
                                    : "12 words, plus a shareable link"}
                                </small>
                              </span>
                              <span className="radio-dot" aria-hidden="true" />
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={requireApproval}
                          onChange={(event) =>
                            setRequireApproval(event.target.checked)
                          }
                        />
                        <span>
                          <strong>Approve each person before they enter</strong>
                          <small>
                            Only let in people you recognize. Names aren’t
                            verified.
                          </small>
                        </span>
                      </label>
                      <details className="disclosure retention-settings">
                        <summary>
                          <Timer size={18} />
                          <span>
                            Room lifetime{" "}
                            <small>
                              Deletes after {ttlHours}{" "}
                              {ttlHours === 1 ? "hour" : "hours"}
                            </small>
                          </span>
                          <ChevronDown
                            size={18}
                            className="disclosure-chevron"
                          />
                        </summary>
                        <div className="disclosure-body">
                          <label htmlFor="room-lifetime">
                            Automatically delete the room after
                            <select
                              id="room-lifetime"
                              value={ttlHours}
                              onChange={(event) =>
                                setTtlHours(Number(event.target.value))
                              }
                            >
                              <option value="1">1 hour</option>
                              <option value="2">2 hours</option>
                              <option value="4">4 hours</option>
                              <option value="8">8 hours</option>
                            </select>
                          </label>
                          <p className="helper-text">
                            You can end the room sooner. Refreshing loses your
                            session and host controls.
                          </p>
                        </div>
                      </details>
                    </>
                  )}
                </div>
                {Object.keys(errors).length > 0 && (
                  <p className="form-error" role="alert">
                    {errors.form ?? "Check the highlighted fields to continue."}
                  </p>
                )}
                {!configured && (tab === "join" || step === 2) && (
                  <p className="notice setup-notice">
                    Live rooms aren’t available here yet. Try a practice room
                    below.
                  </p>
                )}
                <div className="wizard-actions">
                  {tab === "create" && step > 0 && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => changeStep(step - 1)}
                    >
                      <ArrowLeft size={18} /> Back
                    </button>
                  )}
                  <button
                    className="button primary"
                    type="submit"
                    disabled={
                      busy || (!configured && (tab === "join" || step === 2))
                    }
                  >
                    {busy
                      ? "Opening room…"
                      : tab === "join"
                        ? "Join room"
                        : step === 2
                          ? "Create room"
                          : "Continue"}
                    <ArrowRight size={18} />
                  </button>
                </div>
                <div className="encryption-note">
                  <LockKeyhole size={19} />
                  <p>
                    <strong>End-to-end encrypted. Always.</strong>
                    <span>
                      We and our hosting providers don’t have the keys to read
                      your room content.
                    </span>
                    <button type="button" onClick={() => setPrivacy(true)}>
                      How E2EE protects your room <ArrowRight size={14} />
                    </button>
                  </p>
                </div>
              </form>
            </div>
          </div>
          <aside className="welcome-aside">
            <div className="aside-kicker">
              THINK FOR YOURSELF. DECIDE TOGETHER.
            </div>
            <h2>
              Less meeting.
              <br />
              More meaning.
            </h2>
            <p>
              The best estimate isn’t the fastest answer.
              <br />
              It’s the one you arrive at together.
            </p>
            <div className="steps" id="how-it-works">
              <div>
                <span className="step-number">01</span>
                <div>
                  <h3>Gather your people</h3>
                  <p>
                    Share an invitation. Everyone can vote or join as an
                    observer.
                  </p>
                </div>
              </div>
              <div>
                <span className="step-number">02</span>
                <div>
                  <h3>Think for yourself</h3>
                  <p>
                    Discuss an item, then pick a card without seeing anyone
                    else’s.
                  </p>
                </div>
              </div>
              <div>
                <span className="step-number">03</span>
                <div>
                  <h3>Reveal and discuss</h3>
                  <p>
                    The host reveals the cards and moves the team to the next
                    item.
                  </p>
                </div>
              </div>
            </div>
            <div className="practice-card">
              <span className="practice-icon" aria-hidden="true">
                ▱
              </span>
              <div>
                <h3>Get a feel for it.</h3>
                <p>Try a round with sample participants.</p>
              </div>
              <button onClick={onPractice} aria-label="Try a practice room">
                <ArrowRight size={22} />
              </button>
            </div>
          </aside>
        </section>
      </main>
      <footer className="site-footer">
        <span>Made for teams that think together.</span>
        <button onClick={() => setPrivacy(true)}>
          Privacy & room security <ArrowRight size={15} />
        </button>
      </footer>
      {privacy && <Privacy onClose={() => setPrivacy(false)} />}
    </div>
  );
}
