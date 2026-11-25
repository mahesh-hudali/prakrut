import { useLibrary } from "../hooks/useLibrary";
import LibraryView from "./LibraryView";
import BookWorkspace from "./workspace/BookWorkspace";
import "./WriterApp.css";

/**
 * Prakrut's home: the book library, or the open book.
 * A refresh reopens the last book exactly as it was left.
 */
export default function WriterApp() {
  const library = useLibrary();
  if (library.phase === "loading") return <div className="writer-app" aria-busy="true" />;
  if (library.phase === "library") {
    return (
      <div className="writer-app writer-app--library">
        <LibraryView library={library} />
      </div>
    );
  }
  return <BookWorkspace key={library.book.bookId} library={library} />;
}
