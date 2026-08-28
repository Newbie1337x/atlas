/**
 * Mirrors Proteus's shared OffsetPage<T> (see backend
 * com.proteus.api.shared.domain.model.OffsetPage). NOT the same shape as
 * Spring's Page<T> (which uses content / totalElements / totalPages / number).
 *
 * Lives here rather than in a per-module model file because it is genuinely
 * cross-cutting — training, workouts, feed, catalog, and anything else that
 * paginates share this envelope.
 */
export interface OffsetPage<T> {
  items: T[];
  offset: number;
  size: number;
  totalCount: number;
  hasMore: boolean;
}
