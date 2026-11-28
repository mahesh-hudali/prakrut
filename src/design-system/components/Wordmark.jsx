import "./Wordmark.css";

/**
 * ಪ್ರಾಕೃತ — the product name, set in Tiro Kannada. This is the one expressive
 * typographic element in the chrome; everything else stays quiet.
 */
export function Wordmark({ className = "" }) {
  return (
    <span className={`ds-wordmark ${className}`} lang="kn" aria-label="Prakrut">
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="ds-wordmark__mark" />
      ಪ್ರಾಕೃತ
    </span>
  );
}
