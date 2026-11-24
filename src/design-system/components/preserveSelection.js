/**
 * Keep the editor's text selection alive while a control is clicked: toolbar
 * actions (bold, paragraph style…) must know what the author had selected.
 */
export function preserveSelectionHandler(onMouseDown) {
  return (event) => {
    event.preventDefault();
    onMouseDown?.(event);
  };
}
