"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Crown,
  DoorOpen,
  ExternalLink,
  Eye,
  Link2,
  ListOrdered,
  LockKeyhole,
  LogOut,
  Plus,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  UnlockKeyhole,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ConvexError } from "convex/values";
import { DECKS, summarizeVotes } from "@/lib/decks";
import type { Room, RoomActions } from "@/lib/room";
import { Brand } from "./brand";
import { Dialog } from "./dialog";
import { Privacy } from "./privacy";
import { PeopleDialog } from "./people-dialog";
import { useDoorbell } from "./use-doorbell";
import { useRevealCountdown } from "./use-reveal-countdown";
import { AWAY_AFTER_MS } from "@/lib/presence";

const colors = ["peach", "mint", "lilac", "sand", "sky", "rose"];
export function RoomView({
  room,
  memberId,
  code,
  actions,
  connected,
  practice = false,
  recoveryAvailable = true,
}: {
  room: Room;
  memberId: string;
  code: string;
  actions: RoomActions;
  connected: boolean;
  practice?: boolean;
  recoveryAvailable?: boolean;
}) {
  const [modal, setModal] = useState<
    "invite" | "item" | "leave" | "privacy" | "people" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [attentionPaused, setAttentionPaused] = useState(false);
  const [dismissedHandoff, setDismissedHandoff] = useState<number | null>(null);
  const { muted, toggleMuted, ring } = useDoorbell();
  const { countingDown, remaining, revealed } = useRevealCountdown(
    room.round,
    room.revealed,
  );
  const pendingIds = useRef(new Set<string>());
  const arrivalRing = useRef<HTMLSpanElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const previous = document.title;
    document.title = `${room.config.name} · Quorum`;
    return () => {
      document.title = previous;
    };
  }, [room.config.name]);
  useEffect(() => {
    const hasArrival = room.pending.some(
      (entry) => !pendingIds.current.has(entry.id),
    );
    pendingIds.current = new Set(room.pending.map((entry) => entry.id));
    if (hasArrival && memberId === room.hostId) ring();
    if (
      !hasArrival ||
      attentionPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const animation = arrivalRing.current?.animate(
      [
        { boxShadow: "0 0 0 0 rgba(109, 53, 182, 0.38)", opacity: 1 },
        { boxShadow: "0 0 0 14px rgba(109, 53, 182, 0)", opacity: 0 },
      ],
      { duration: 1200, easing: "ease-out" },
    );
    return () => animation?.cancel();
  }, [room.pending, attentionPaused, memberId, room.hostId, ring]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const me = room.participants.find((member) => member.id === memberId)!;
  const isHost = memberId === room.hostId;
  const voters = room.participants.filter((member) => member.role === "voter");
  const observers = room.participants.filter(
    (member) => member.role === "observer",
  );
  const voted = voters.filter((member) => member.hasVoted).length;
  const currentItem = room.items[0];
  const summary = summarizeVotes(
    room.config.cards,
    voters.map((member) => member.vote),
  );
  const disabled = busy || !connected || countingDown;
  const minutes = Math.max(0, Math.ceil((room.expiresAt - now) / 60_000));
  const lifetime =
    minutes >= 60
      ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
      : `${minutes}m`;
  async function run(action: () => Promise<void>, close = false) {
    setError("");
    setBusy(true);
    try {
      await action();
      if (close) setModal(null);
    } catch (err) {
      setError(
        err instanceof ConvexError
          ? String(err.data)
          : err instanceof Error
            ? err.message
            : "That didn’t go through. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setError(
        "Copy didn’t work. Select the invitation below and copy it manually.",
      );
    }
  }
  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await actions.addItem({
        name: String(data.get("itemName")),
        url: String(data.get("itemUrl")),
      });
      setQueueOpen(true);
    }, true);
  }
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/#room=${encodeURIComponent(code)}`;

  return (
    <div className="room-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="room-header">
        <div className="room-breadcrumb">
          <Brand onClick={() => setModal("leave")} />
          <span className="breadcrumb-divider" />
          <span className="breadcrumb-name">{room.config.name}</span>
          <span className="subtle-pill">
            {practice ? (
              "Practice"
            ) : (
              <>
                <span className={`status-dot ${connected ? "" : "offline"}`} />
                {connected ? "Live room" : "Reconnecting…"}
              </>
            )}
          </span>
        </div>
        <div className="room-header-actions">
          <button
            className="button small secondary"
            onClick={() => setModal("people")}
          >
            <Users size={16} /> People <span>{room.participants.length}</span>
          </button>
          <button
            className="button small secondary"
            onClick={() => setModal("invite")}
          >
            <Link2 size={16} /> Invite people
          </button>
          <button
            className="icon-button"
            title={isHost ? "End room" : "Leave room"}
            aria-label={isHost ? "End room" : "Leave room"}
            onClick={() => setModal("leave")}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      {practice && (
        <div className="practice-banner">
          <span>
            <Sparkle /> A practice room with sample participants. Nothing is
            shared or saved.
          </span>
          <button onClick={() => void actions.leave()}>
            Back to start <ArrowRight size={14} />
          </button>
        </div>
      )}
      <main className="room-main" id="main-content" tabIndex={-1}>
        <div className="room-title-row">
          <div>
            <div className="eyebrow">A LITTLE CLARITY, TOGETHER</div>
            <h1>{room.config.name}</h1>
          </div>
          <div className="room-title-meta">
            <span>
              <Timer size={15} /> Deletes in {lifetime}
            </span>
            <button onClick={() => setModal("privacy")}>
              <ShieldCheck size={15} />
              {practice ? "Stays in this tab" : "End-to-end encrypted"}
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="form-error room-error">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
        {room.hostChangedAt !== null &&
          room.hostChangedAt !== dismissedHandoff && (
            <div className="room-notice">
              <p role="status">
                {isHost
                  ? "You’re now the host."
                  : `${room.participants.find((member) => member.id === room.hostId)?.name ?? "Another participant"} is now the host.`}{" "}
                The previous host disconnected.
              </p>
              <button
                className="icon-button"
                aria-label="Dismiss host change"
                onClick={() => setDismissedHandoff(room.hostChangedAt)}
              >
                <X size={16} />
              </button>
            </div>
          )}
        {!practice && !recoveryAvailable && (
          <p role="status" className="notice">
            This browser blocked session storage. Keep this tab open; after a
            refresh, you’ll need to join again with your invitation.
          </p>
        )}
        <p role="status" className="sr-only" aria-atomic="true">
          {isHost && room.pending.length > 0
            ? `${room.pending.length} ${room.pending.length === 1 ? "person is" : "people are"} waiting to join: ${room.pending.map((entry) => entry.name).join(", ")}.`
            : ""}
        </p>
        <div className="room-layout">
          <div className="voting-column">
            <section className="current-item">
              <div className="section-label">
                <span className="status-dot" />{" "}
                {currentItem ? "ON THE TABLE" : "A FRESH START"}
                <span className="round-label">
                  ROUND {room.round.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="item-title-line">
                <h2>{currentItem?.name ?? "What should we estimate?"}</h2>
                {currentItem?.url && (
                  <a
                    href={currentItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="icon-button"
                    aria-label="Open current item link"
                  >
                    <ExternalLink size={19} />
                  </a>
                )}
              </div>
              <p>
                {currentItem
                  ? revealed
                    ? "The cards are up. Make space for different perspectives."
                    : "Take your time. Your estimate stays hidden until the reveal."
                  : "Add the first item to give everyone something to think about."}
              </p>
              {!currentItem && (
                <button
                  className="button secondary small"
                  onClick={() => setModal("item")}
                >
                  <Plus size={16} /> Add an item
                </button>
              )}
            </section>
            <section
              className={`table-area ${revealed ? "is-revealed" : ""}`}
              aria-label="Voting table"
            >
              <div className="table-seats">
                {voters.map((member, index) => (
                  <div key={member.id} className="seat">
                    <div
                      className={`seat-card ${member.hasVoted ? "has-voted" : ""} ${revealed ? "flipped" : ""} ${revealed && member.vote !== null && room.config.cards[member.vote]?.length > 3 ? "long-label" : ""}`}
                    >
                      {revealed ? (
                        member.vote !== null ? (
                          room.config.cards[member.vote]
                        ) : (
                          "—"
                        )
                      ) : member.hasVoted ? (
                        <Check size={25} />
                      ) : (
                        <span className="seat-card-pattern">q.</span>
                      )}
                    </div>
                    <div className="seat-name">
                      <span
                        className={`avatar-dot ${colors[index % colors.length]}`}
                      >
                        {member.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        {member.id === memberId
                          ? `${member.name === "You" ? "You" : `${member.name} (you)`}`
                          : member.name}
                      </span>
                      {member.id === room.hostId && <Crown size={12} />}
                    </div>
                    <span className="seat-status">
                      {!practice && now - member.lastSeen > AWAY_AFTER_MS
                        ? "Reconnecting…"
                        : revealed
                          ? member.vote !== null
                            ? "Revealed"
                            : "No vote"
                          : member.hasVoted
                            ? "Ready"
                            : "Thinking…"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="table-center">
                <span
                  className={`table-logo ${countingDown ? "reveal-countdown" : ""}`}
                  aria-hidden="true"
                >
                  {countingDown ? remaining : "q."}
                </span>
                <div className="table-center-copy">
                  <h3>
                    {countingDown
                      ? "Here come the cards."
                      : !currentItem
                        ? "Your next idea belongs here."
                        : revealed
                          ? summary.consensus
                            ? "You’re on the same page."
                            : "Every perspective counts."
                          : voted === voters.length && voted > 0
                            ? "All cards are in."
                            : "A moment to think."}
                  </h3>
                  <p aria-live="polite">
                    {countingDown
                      ? `Revealing in ${remaining}…`
                      : !currentItem
                        ? "Add an item to begin"
                        : revealed
                          ? "Time for the conversation"
                          : `${voted} of ${voters.length} votes are in`}
                  </p>
                </div>
                {isHost && currentItem && (
                  <button
                    className={`button ${room.revealed ? "secondary" : "primary"}`}
                    disabled={disabled || (!room.revealed && !voted)}
                    onClick={() =>
                      void run(room.revealed ? actions.next : actions.reveal)
                    }
                  >
                    {countingDown
                      ? "Revealing…"
                      : room.revealed
                        ? room.items.length > 1
                          ? "Next item"
                          : "Finish item"
                        : "Reveal cards"}
                    {room.revealed ? (
                      <ArrowRight size={17} />
                    ) : (
                      <Eye size={17} />
                    )}
                  </button>
                )}
                {!isHost && currentItem && (
                  <span className="host-wait">
                    {room.revealed
                      ? "The host will move things along."
                      : "The host will reveal the cards."}
                  </span>
                )}
              </div>
              {observers.length > 0 && (
                <div className="observers">
                  <Eye size={14} />
                  <span>
                    {observers
                      .map((member) =>
                        member.id === memberId
                          ? `${member.name} (you)`
                          : member.name,
                      )
                      .join(", ")}
                  </span>
                  <span className="observer-caption">
                    {observers.length === 1 ? "is observing" : "are observing"}
                  </span>
                </div>
              )}
            </section>
            {revealed ? (
              <section className="results-panel">
                <div className="results-heading">
                  <div>
                    <div className="section-label">THE REVEAL</div>
                    <h3>
                      {summary.consensus
                        ? "A shared point of view."
                        : "A good place to start talking."}
                    </h3>
                  </div>
                  {isHost && (
                    <button
                      className="button ghost small"
                      disabled={disabled}
                      onClick={() => void run(actions.reset)}
                    >
                      <RotateCcw size={14} /> Vote again
                    </button>
                  )}
                </div>
                <div className="results-body">
                  <div className="vote-distribution">
                    {summary.counts
                      .filter(({ count }) => count > 0)
                      .map(({ card, count }) => (
                        <div key={card} className="distribution-row">
                          <strong>{card}</strong>
                          <div>
                            <span
                              style={{
                                width: `${(count / Math.max(summary.total, 1)) * 100}%`,
                              }}
                            />
                          </div>
                          <span>
                            {count} {count === 1 ? "vote" : "votes"}
                          </span>
                        </div>
                      ))}
                    {summary.total === 0 && (
                      <p>No readable estimates this round.</p>
                    )}
                  </div>
                  <div className="result-stats">
                    {summary.average !== null && (
                      <div>
                        <strong>{summary.average}</strong>
                        <span>Average</span>
                      </div>
                    )}
                    <div>
                      <strong>{summary.agreement}%</strong>
                      <span>Agreement</span>
                    </div>
                  </div>
                </div>
                <p className="results-note">
                  “?” and coffee cards are excluded from the average and
                  agreement.
                </p>
              </section>
            ) : (
              <section className="your-cards">
                <div className="your-cards-heading">
                  <h3>
                    {me.role === "observer"
                      ? "A seat for listening."
                      : "What’s your instinct?"}
                  </h3>
                  <span>
                    {me.role === "observer"
                      ? "You’re observing this round"
                      : me.vote !== null
                        ? "Your card is in. You can still change it."
                        : "Choose your card"}
                  </span>
                </div>
                {me.role === "voter" ? (
                  <div className="card-deck">
                    {room.config.cards.map((card, index) => (
                      <button
                        key={index}
                        className={`voting-card ${me.vote === index ? "chosen" : ""} ${card.length > 3 ? "long-label" : ""}`}
                        aria-label={`Vote ${card}`}
                        aria-pressed={me.vote === index}
                        disabled={disabled || !currentItem}
                        onClick={() =>
                          void run(() =>
                            actions.vote(me.vote === index ? null : index),
                          )
                        }
                      >
                        {card.length <= 3 && (
                          <span className="card-corner" aria-hidden="true">
                            {card}
                          </span>
                        )}
                        <strong>{card}</strong>
                        {card.length <= 3 && (
                          <span
                            className="card-corner bottom"
                            aria-hidden="true"
                          >
                            {card}
                          </span>
                        )}
                        {me.vote === index && (
                          <span className="card-chosen-check">
                            <Check size={11} />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="observer-empty">
                    <Eye size={25} />
                    <p>Follow along, or join the vote when you’re ready.</p>
                  </div>
                )}
                <div className="deck-footer">
                  <span>
                    {room.config.deck === "custom"
                      ? "Custom deck"
                      : DECKS[room.config.deck].name}
                    <span className="dot-separator">·</span>
                    {room.config.cards.length} cards
                  </span>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      void run(() =>
                        actions.setRole(
                          me.role === "observer" ? "voter" : "observer",
                        ),
                      )
                    }
                  >
                    {me.role === "observer" ? (
                      <>
                        <Users size={13} /> Join the vote
                      </>
                    ) : (
                      <>
                        <Eye size={13} /> Just observing?
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}
          </div>
          <aside className="room-sidebar">
            {isHost && room.pending.length > 0 && (
              <section
                className={`waiting-panel ${attentionPaused ? "attention-paused" : ""}`}
                aria-label="Join requests"
              >
                <span
                  className="arrival-ring"
                  ref={arrivalRing}
                  aria-hidden="true"
                />
                <div className="panel-heading">
                  <h2>
                    <DoorOpen size={20} /> At the door
                  </h2>
                  <span className="count-badge">{room.pending.length}</span>
                  <button
                    className="icon-button attention-toggle"
                    type="button"
                    aria-label={
                      attentionPaused
                        ? "Resume waiting-room animation"
                        : "Pause waiting-room animation"
                    }
                    title={
                      attentionPaused ? "Resume animation" : "Pause animation"
                    }
                    onClick={() => setAttentionPaused(!attentionPaused)}
                  >
                    {attentionPaused ? <Play size={16} /> : <Pause size={16} />}
                  </button>
                </div>
                <p>Names aren’t verified. Approve people you recognize.</p>
                {room.pending.map((entry) => (
                  <div className="pending-member" key={entry.id}>
                    <span className="mini-avatar lilac">
                      {entry.name.slice(0, 1)}
                    </span>
                    <strong>{entry.name}</strong>
                    <button
                      className="icon-button"
                      disabled={disabled}
                      aria-label={`Decline ${entry.name}`}
                      onClick={() =>
                        void run(() => actions.admit(entry.id, false))
                      }
                    >
                      <X size={15} />
                    </button>
                    <button
                      className="approve-button"
                      disabled={disabled}
                      aria-label={`Admit ${entry.name}`}
                      onClick={() =>
                        void run(() => actions.admit(entry.id, true))
                      }
                    >
                      <Check size={15} />
                    </button>
                  </div>
                ))}
                <div className="door-controls">
                  <button
                    className="button ghost small"
                    aria-label="Arrival sound"
                    aria-pressed={!muted}
                    onClick={toggleMuted}
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}{" "}
                    Sound {muted ? "off" : "on"}
                  </button>
                </div>
              </section>
            )}
            <section className="queue-panel">
              <h2 className="queue-heading">
                <ListOrdered size={20} />
                <span>Item queue</span>
                <span className="count-badge">{room.items.length}</span>
              </h2>
              <button
                type="button"
                className="queue-disclosure"
                aria-label={`${queueOpen ? "Hide" : "Show"} queued items`}
                aria-expanded={queueOpen}
                aria-controls="room-queue-items"
                onClick={() => setQueueOpen(!queueOpen)}
              >
                <ChevronRight size={20} className="queue-chevron" />
                <span className="queue-preview">
                  {room.items.length > 1 ? (
                    <>
                      <strong>{room.items.length - 1} up next</strong>
                      <span>Next: {room.items[1].name}</span>
                    </>
                  ) : currentItem ? (
                    "No more items queued."
                  ) : (
                    "Add an item to start the conversation."
                  )}
                </span>
              </button>
              <div id="room-queue-items" hidden={!queueOpen}>
                <ol className="queue-list">
                  {room.items.map((item, index) => (
                    <li key={item.id} className={index === 0 ? "current" : ""}>
                      <span className="queue-number">
                        {index === 0 ? (
                          <span className="status-dot" />
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </span>
                      <div>
                        <span className="queue-item-name">{item.name}</span>
                        {index === 0 && (
                          <span className="queue-current-label">
                            Discussing now
                          </span>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open link <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {isHost && index > 0 && (
                        <button
                          className="queue-remove icon-button"
                          disabled={disabled}
                          aria-label={`Remove ${item.name}`}
                          onClick={() =>
                            void run(() => actions.removeItem(item.id))
                          }
                        >
                          <X size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
                {room.items.length === 0 && (
                  <div className="queue-empty">
                    <ListOrdered size={28} />
                    <p>A little room for your next idea.</p>
                  </div>
                )}
                <p className="queue-note">Completed items aren’t saved.</p>
              </div>
              <button
                className="button queue-add"
                disabled={disabled || room.items.length >= 30}
                onClick={() => setModal("item")}
              >
                <Plus size={16} /> Add item
              </button>
            </section>
            <section className="room-safety">
              <div className="safety-title">
                <LockKeyhole size={19} />
                <h2>Room access</h2>
              </div>
              {isHost ? (
                <button
                  type="button"
                  role="switch"
                  aria-label="Lock room"
                  aria-checked={room.locked}
                  aria-describedby="lock-help"
                  className={`lock-switch ${room.locked ? "is-locked" : ""}`}
                  disabled={disabled}
                  onClick={() =>
                    void run(() => actions.setLocked(!room.locked))
                  }
                >
                  <span className="switch-thumb" aria-hidden="true" />
                  <span
                    className={`switch-state ${!room.locked ? "selected" : ""}`}
                  >
                    <UnlockKeyhole size={18} /> Open
                  </span>
                  <span
                    className={`switch-state ${room.locked ? "selected" : ""}`}
                  >
                    <LockKeyhole size={18} /> Locked
                  </span>
                </button>
              ) : (
                <p className="access-status">
                  {room.locked ? (
                    <LockKeyhole size={18} />
                  ) : (
                    <UnlockKeyhole size={18} />
                  )}
                  {room.locked ? "Room locked" : "Room open"}
                </p>
              )}
              <p id="lock-help" role="status">
                {room.locked
                  ? "Locked. New people can’t join or request access."
                  : room.requireApproval
                    ? `Open for requests. ${isHost ? "You approve" : "The host approves"} each person before they enter.`
                    : "Open. Anyone with the invitation can join."}
              </p>
              <div className="safety-rule" />
              <div className="safety-title encryption-title">
                <ShieldCheck size={19} />
                <h3>End-to-end encrypted</h3>
              </div>
              <p>
                We and our hosting providers don’t have the keys to read your
                room content.
              </p>
              <details className="disclosure room-retention">
                <summary>
                  <span>When the room ends</span>
                  <ChevronDown size={18} className="disclosure-chevron" />
                </summary>
                <div className="disclosure-body">
                  <p>
                    Active room data is deleted. Any room content retained in
                    provider backups stays encrypted and unreadable without your
                    invitation key.
                  </p>
                  <p>
                    Connection metadata is separate. People in the room may keep
                    their own copies.
                  </p>
                </div>
              </details>
              <button className="text-link" onClick={() => setModal("privacy")}>
                How E2EE protects your room <ArrowRight size={15} />
              </button>
            </section>
          </aside>
        </div>
      </main>
      <footer className="room-footer">
        <span>
          <LockKeyhole size={12} /> No accounts. No saved history.
        </span>
        <span>Make room for a different perspective.</span>
        <button onClick={() => setModal("privacy")}>
          <CircleHelp size={14} /> Room security
        </button>
      </footer>
      {modal === "privacy" && <Privacy onClose={() => setModal(null)} />}
      {modal === "people" && (
        <PeopleDialog
          room={room}
          memberId={memberId}
          actions={actions}
          connected={connected}
          practice={practice}
          now={now}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "item" && (
        <Dialog title="What’s up next?" onClose={() => setModal(null)}>
          <p className="dialog-intro">
            Give your team something to think about.
          </p>
          <form onSubmit={addItem} className="dialog-form">
            <label>
              Item name
              <input
                name="itemName"
                placeholder="e.g. Add a simpler checkout flow"
                maxLength={160}
                required
                data-autofocus
              />
            </label>
            <label>
              Link <span className="optional">optional</span>
              <input
                name="itemUrl"
                type="url"
                placeholder="https://…"
                maxLength={1000}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={disabled}>
              Add to queue <Plus size={17} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === "invite" && (
        <Dialog
          title="Good company, one invitation away."
          onClose={() => setModal(null)}
        >
          {practice ? (
            <>
              <p className="dialog-intro">
                This practice room is just for you. Create a live room to invite
                your team.
              </p>
              <button
                className="button primary full"
                onClick={() => void actions.leave()}
              >
                Back to start <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <p className="dialog-intro">
                {room.requireApproval
                  ? "Share the invitation. You’ll approve each person before they enter."
                  : "Anyone with this invitation can join the room. Share it privately."}
              </p>
              <label>
                Invitation link
                <div className="copy-field">
                  <input
                    value={link}
                    readOnly
                    aria-label="Invitation link"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    className="icon-button"
                    onClick={() => void copy(link, "link")}
                    aria-label="Copy invitation link"
                  >
                    {copied === "link" ? (
                      <Check size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>
              </label>
              {code.includes(" ") && (
                <label className="passphrase-label">
                  Or share the passphrase
                  <div className="passphrase-value">{code}</div>
                  <button
                    className="button secondary full small"
                    onClick={() => void copy(code, "passphrase")}
                  >
                    {copied === "passphrase" ? (
                      <Check size={15} />
                    ) : (
                      <Copy size={15} />
                    )}
                    {copied === "passphrase" ? "Copied" : "Copy passphrase"}
                  </button>
                </label>
              )}
              <div className="notice invite-notice">
                <LockKeyhole size={15} />
                <p>
                  The invitation contains your room’s encryption secret. Don’t
                  post it publicly. Display names aren’t verified.
                </p>
              </div>
              <p className="form-footnote">
                Refreshing this tab restores your place while your session is
                active. After two minutes without a connection, you’ll need to
                join again.
              </p>
              <span className="sr-only" role="status">
                {copied ? "Invitation copied" : ""}
              </span>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {modal === "leave" && (
        <Dialog
          title={isHost ? "Call it a session?" : "Leave this room?"}
          onClose={() => setModal(null)}
        >
          <p className="dialog-intro">
            {isHost
              ? "Ending the room removes its active data and closes it for everyone. There’s no saved history to come back to."
              : "Your name and vote will be removed from the room. You can rejoin with the invitation."}
          </p>
          {isHost && (
            <details className="disclosure">
              <summary>
                <span>What happens to stored data?</span>
                <ChevronDown size={18} className="disclosure-chevron" />
              </summary>
              <div className="disclosure-body">
                <p>
                  Any room content in provider backups stays encrypted.
                  Providers don’t have the key to read it. Connection metadata
                  and copies made by participants may remain.
                </p>
              </div>
            </details>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Stay here
            </button>
            <button
              className="button danger"
              disabled={disabled}
              onClick={() => void run(actions.leave)}
            >
              {isHost ? <Trash2 size={16} /> : <LogOut size={16} />}
              {isHost ? "End & delete room" : "Leave room"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function Sparkle() {
  return <span aria-hidden="true">✳</span>;
}
