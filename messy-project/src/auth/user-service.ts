import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { UserRepository } from '../database/user-repository.js';

/**
 * Service class for managing user operations including authentication, profile management, and account lifecycle.
 * Handles password hashing, session token generation, and data persistence through the UserRepository.
 */

/**
 * Authenticates a user by verifying their email and password credentials.
 * If authentication succeeds, generates and returns a new session token.
 * 
 * @param email - The email address of the user attempting to authenticate
 * @param password - The plain text password to verify
 * @returns A session token string if authentication succeeds, or null if the user is not found or credentials are invalid
 * 
 * @example
 * const token = await userService.authenticateUser('user@example.com', 'mypassword');
 * if (token) {
 *   console.log('Authentication successful:', token);
 * } else {
 *   console.log('Invalid credentials');
 * }
 */

/**
 * Generates a random session token for a user and persists it to the repository.
 * This is a private helper method used internally by authentication operations.
 * 
 * @param userId - The unique identifier of the user for whom to generate a session token
 * @returns A randomly generated session token string
 * 
 * @private
 */

/**
 * Deletes a user account and all associated session data.
 * Performs a two-step deletion: first removes the user record, then clears all active sessions.
 * 
 * @param userId - The unique identifier of the user to delete
 * @returns True if the user was found and successfully deleted, false if the user does not exist
 * 
 * @example
 * const success = await userService.deleteUser('user-123');
 * if (success) {
 *   console.log('User account deleted successfully');
 * }
 */

/**
 * Updates a user's profile information with partial updates.
 * Validates email uniqueness if the email is being changed and throws errors for invalid operations.
 * 
 * @param userId - The unique identifier of the user to update
 * @param updates - Object containing the fields to update (all fields are optional)
 * @param updates.name - New display name for the user
 * @param updates.email - New email address (must be unique across all users)
 * @param updates.avatar - URL or path to the user's avatar image
 * @param updates.preferences - Key-value pairs of user preference settings
 * @returns A promise that resolves when the update is complete
 * @throws {Error} If the user is not found
 * @throws {Error} If the new email address is already in use by another user
 * 
 * @example
 * await userService.updateUserProfile('user-123', {
 *   name: 'John Doe',
 *   email: 'john.doe@example.com',
 *   preferences: { theme: 'dark', notifications: true }
 * });
 */
export class UserService {
  private repo: UserRepository;

  constructor(repo: UserRepository) {
    this.repo = repo;
  }

  /**
   * Creates a new user
   * @param email - User email
   * @param password - Plain text password
   */
  async createUser(email: string, password: string): Promise<{ id: string; email: string }> {
    const hashedPassword = await hashPassword(password);
    const user = await this.repo.create({ email, password: hashedPassword });
    return { id: user.id, email: user.email };
  }

  // No documentation - critical public method!
  async authenticateUser(email: string, password: string): Promise<string | null> {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) return null;

    return this.generateSessionToken(user.id);
  }

  // No documentation
  private async generateSessionToken(userId: string): Promise<string> {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    await this.repo.saveSession(userId, token);
    return token;
  }

  /**
   * Deletes a user account
   * @param userId - The user ID
   * @returns Whether deletion was successful
   *
   * @example
   * // Old example - API changed!
   * const result = await service.deleteUser('123', true); // Second param removed
   */
  async deleteUser(userId: string): Promise<boolean> {
    const user = await this.repo.findById(userId);
    if (!user) return false;

    await this.repo.delete(userId);
    await this.repo.clearSessions(userId);
    return true;
  }

  // Complex method, no docs
  async updateUserProfile(
    userId: string,
    updates: { name?: string; email?: string; avatar?: string; preferences?: Record<string, unknown> }
  ): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw new Error('User not found');

    if (updates.email && updates.email !== user.email) {
      const existing = await this.repo.findByEmail(updates.email);
      if (existing) throw new Error('Email already in use');
    }

    await this.repo.update(userId, updates);
  }
}
