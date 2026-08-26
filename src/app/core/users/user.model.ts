/**
 * Mirror of Proteus's UserResponse — enriched user record fetched from
 * GET /api/users/me. Keep field names in sync with the backend DTO
 * (`UserResponse.java`) so serialization is direct.
 */
export interface UserProfile {
  id:               number;
  organizationId:   number;
  email:            string;
  firstName:        string | null;
  lastName:         string | null;
  role:             string;
  active:           boolean;
  emailVerified:    boolean;
  /** Portable identity avatar (Google `picture`, later self-uploaded). */
  avatarUrl:        string | null;
  /** External providers linked to this user — 'GOOGLE', 'FACEBOOK', … */
  linkedProviders:  string[];
  /** True when the user set an email+password; false for OAuth-only accounts. */
  hasLocalPassword: boolean;
  createdAt:        string;
  attributes:       Record<string, unknown> | null;
}
