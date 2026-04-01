export function SkeletonCard() {
  return (
    <article className="repo-card skeleton-card" aria-hidden="true">
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-subtitle" />
      <div className="skeleton-line skeleton-chip" />
      <div className="skeleton-line skeleton-summary" />
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-button" />
    </article>
  );
}
