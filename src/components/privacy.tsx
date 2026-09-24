import {
  ChevronDown,
  KeyRound,
  LockKeyhole,
  Timer,
  UserRound,
} from "lucide-react";
import { Dialog } from "./dialog";
export function Privacy({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="End-to-end encrypted. Always." onClose={onClose}>
      <div className="privacy-lead">
        <LockKeyhole size={28} />
        <p>
          <strong>Your room content is encrypted on your device.</strong> We and
          our hosting providers don’t receive the keys needed to read it.
        </p>
      </div>
      <div className="privacy-points">
        <section>
          <LockKeyhole />
          <div>
            <h3>What stays between your team</h3>
            <p>
              Room names, display names, card values, votes, item names, and
              links. They’re encrypted before upload and decrypted on
              participants’ devices.
            </p>
          </div>
        </section>
        <section>
          <KeyRound />
          <div>
            <h3>Your invitation is also a key</h3>
            <p>
              Share it privately. Anyone with the invitation can derive the room
              key. Host approval controls who receives room content; names
              aren’t verified identities.
            </p>
          </div>
        </section>
      </div>
      <details className="disclosure privacy-details">
        <summary>
          <span>What encryption doesn’t hide</span>
          <ChevronDown size={18} className="disclosure-chevron" />
        </summary>
        <div className="disclosure-body">
          <p>
            Providers can see connection details such as IP addresses,
            participant counts, and activity times. They store encrypted room
            content during the session, but don’t receive its key.
          </p>
          <p>
            A participant can copy or share what they see. A leaked invitation
            or a compromised device or app can expose content. Only share
            invitations with people you trust.
          </p>
          <p>
            Host approval doesn’t change the key. If an invitation leaks, end
            the room and create a new one.
          </p>
        </div>
      </details>
      <details className="disclosure privacy-details">
        <summary>
          <Timer size={18} />
          <span>Encryption and deletion</span>
          <ChevronDown size={18} className="disclosure-chevron" />
        </summary>
        <div className="disclosure-body">
          <p>
            Encryption protects what you share. Deletion controls how long
            stored data remains. Ending or expiring a room deletes its active
            data, with no saved history in the app.
          </p>
          <p>
            Any room content retained in provider backups stays encrypted and
            unreadable without your invitation key. Providers don’t receive that
            key. Connection metadata is separate, and people in the room may
            keep their own copies.
          </p>
          <p>
            This tab keeps your invitation and private session credential in
            browser session storage so a refresh can restore your place. Room
            content isn’t saved there. Leaving or losing your session clears
            those credentials; closing the tab normally clears them too.
          </p>
          <p>
            After two minutes without a connection, your participant is removed.
            If the host disconnects, hosting passes to the longest-present
            person. The room ends when no participants remain connected.
          </p>
        </div>
      </details>
      <details className="disclosure privacy-details">
        <summary>
          <UserRound size={18} />
          <span>Encryption details</span>
          <ChevronDown size={18} className="disclosure-chevron" />
        </summary>
        <div className="disclosure-body">
          <p>
            Room content uses AES-256-GCM. Invite links contain 256 random bits;
            12-word passphrases contain 132 bits. The secret stays in the link
            fragment and isn’t sent to our servers.
          </p>
          <p>
            Quorum uses a shared room key. It doesn’t use WhatsApp’s protocol,
            identity verification, or forward secrecy. The server controls when
            encrypted votes are released.
          </p>
          <p>
            There are no analytics, advertising cookies, or saved room history.
          </p>
        </div>
      </details>
      <button className="button primary full privacy-close" onClick={onClose}>
        Close security details
      </button>
    </Dialog>
  );
}
