import PageContent from "../PageContent/PageContent";
import "./BookPage.css";

export default function BookPage({
  page,
  pageNumber,
  totalPages,
  showPageNumber = true,
  headerText = "",
  isRightPage = true,
  activeBlockId,
  placeholderBlockId,
  getItemDecorations,
  decorationsKey,
  onPageInput,
  onPageKeyDown,
  onPagePaste,
  onCommentMarkClick,
  readOnly = false,
}) {
  return (
    <article
      className={`book-page ${isRightPage ? "is-right" : "is-left"}`}
      data-page-index={page.pageIndex}
      aria-label={`Page ${pageNumber} of ${totalPages}`}
    >
      {headerText ? (
        <header className="book-page-header" aria-hidden="true">
          {headerText}
        </header>
      ) : null}

      <div className="book-page-inner">
        <PageContent
          items={page.items}
          pageIndex={page.pageIndex}
          activeBlockId={activeBlockId}
          placeholderBlockId={placeholderBlockId}
          getItemDecorations={getItemDecorations}
          decorationsKey={decorationsKey}
          onPageInput={onPageInput}
          onPageKeyDown={onPageKeyDown}
          onPagePaste={onPagePaste}
          onCommentMarkClick={onCommentMarkClick}
          readOnly={readOnly}
        />
      </div>

      {showPageNumber && (
        <footer className="book-page-number" aria-hidden="true">
          {pageNumber}
        </footer>
      )}
    </article>
  );
}
