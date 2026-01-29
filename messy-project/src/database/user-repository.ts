export interface User {
  id: string;
  email: string;
  password: string;
  name?: string;
  avatar?: string;
  preferences?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Repository for user data access
 */
export class UserRepository {
  private users: Map<string, User> = new Map();
  private sessions: Map<string, { userId: string; token: string; expiresAt: Date }> = new Map();

  /**
   * Creates a new user
   * @param data - User data
   * @returns Created user
   *
   * @example
   * const user = await repo.create({
   *   email: 'test@example.com',
   *   password: 'hashed_password_here'
   * });
   */
  async create(data: { email: string; password: string }): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substring(7),
      email: data.email,
      password: data.password,
      createdAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  // Missing docs for frequently used method
  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, updates);
    }
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  async saveSession(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    this.sessions.set(token, { userId, token, expiresAt });
  }

  async clearSessions(userId: string): Promise<void> {
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
      }
    }
  }
}
