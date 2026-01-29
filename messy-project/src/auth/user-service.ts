import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { UserRepository } from '../database/user-repository.js';

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
