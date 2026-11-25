import { useState } from "react";
import { Button, Icon, TextInput, Wordmark } from "../design-system";
import "./LibraryView.css";

function formatWhen(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `Today, ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Where the books live, and what the writer can do about it. */
function FolderStatus({ folder, onChoose, onReconnect }) {
  if (folder.status === "granted") {
    return (
      <p className="library__folder is-ok">
        <Icon name="check" size={16} />
        Books are kept in your <strong>Documents › {folder.handle?.name}</strong> folder.
        <Button size="sm" onClick={onChoose}>Change folder</Button>
      </p>
    );
  }
  if (folder.status === "prompt" || folder.status === "denied") {
    return (
      <p className="library__folder is-attention">
        <Icon name="alert" size={16} />
        Allow access to <strong>{folder.handle?.name}</strong> to see every book and keep backups there.
        <Button size="sm" variant="primary" onClick={onReconnect}>Allow access</Button>
      </p>
    );
  }
  if (folder.status === "unsupported") {
    return (
      <p className="library__folder is-attention">
        <Icon name="alert" size={16} />
        This browser cannot use a folder on your computer. Books are kept in this browser; use Chrome or Edge to keep them in Documents.
      </p>
    );
  }
  return (
    <p className="library__folder is-attention">
      <Icon name="alert" size={16} />
      Choose where your books are kept. Pick your <strong>Documents</strong> folder; a{" "}
      <strong>prakrut-kbooks</strong> folder is created inside it.
      <Button size="sm" variant="primary" onClick={onChoose}>Choose folder</Button>
    </p>
  );
}

export default function LibraryView({ library }) {
  const { books, folder, save } = library;
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("kn");
  const [kind, setKind] = useState("book");
  const [busy, setBusy] = useState(false);

  const [asking, setAsking] = useState(false);

  // "New book" asks for language and type in a small dialog first.
  const create = async (event) => {
    event.preventDefault();
    if (!asking) {
      setAsking(true);
      return;
    }
    setBusy(true);
    try {
      await library.createBook(title.trim() || "Untitled book", { language, kind });
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <main className="library">
      <header className="library__header">
        <Wordmark />
        <h1>Your books</h1>
      </header>

      <FolderStatus folder={folder} onChoose={library.chooseFolder} onReconnect={library.reconnectFolder} />
      {save.error ? <p className="library__error" role="alert">{save.error}</p> : null}

      <form className="library__new" onSubmit={create}>
        <TextInput
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title of your new book"
          aria-label="Title of your new book"
          lang="kn"
        />
        <Button type="submit" variant="primary" icon="plus" disabled={busy}>
          New book
        </Button>
      </form>

      {asking ? (
        <div className="library__dialog-backdrop" onClick={() => setAsking(false)}>
          <form
            className="library__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="New book"
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
          >
            <h2>New book</h2>
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Title"
              autoFocus
            />
            <fieldset>
              <legend>Writing language</legend>
              {[["kn", "Kannada"], ["en", "English"]].map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="language" checked={language === v} onChange={() => setLanguage(v)} /> {l}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Type</legend>
              {[["book", "Book"], ["script", "Script"]].map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="kind" checked={kind === v} onChange={() => setKind(v)} /> {l}
                </label>
              ))}
            </fieldset>
            <div className="library__dialog-actions">
              <Button onClick={() => setAsking(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>Create</Button>
            </div>
          </form>
        </div>
      ) : null}

      {books.length === 0 ? (
        <p className="library__empty">No books yet. Give your first book a title and start writing.</p>
      ) : (
        <ul className="library__list">
          {books.map((entry) => (
            <li key={entry.bookId}>
              <button type="button" className="library__book" onClick={() => library.openBook(entry)}>
                <Icon name="book" size={20} />
                <span className="library__book-title" lang="kn">{entry.title}</span>
                <span className="library__book-meta">
                  {entry.inFolder ? (
                    <span>{entry.folderName}</span>
                  ) : (
                    <span className="is-attention">Only in this browser</span>
                  )}
                  <span>{formatWhen(entry.modifiedAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
