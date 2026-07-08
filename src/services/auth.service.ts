import bcrypt from 'bcrypt';
import { users } from '../db/schema/users.schema.js';
import { db } from '../db/index.js';

const saltRounds: number = 12;

const hashPassword = async (password: string) => {
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (
  hashedPassword: string,
  plainTextPassword: string,
) => {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};

const createNewUser = async (user: typeof users.$inferInsert) => {
  return await db
    .insert(users)
    .values(user)
    .onConflictDoNothing({ target: users.email })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
    });
};

export const registerUser = async (
  email: string,
  password: string,
  name: string,
  isAdmin: boolean,
) => {
  const hashedPassword = await hashPassword(password);
  const user: typeof users.$inferInsert = {
    email,
    hashedPassword,
    name,
    isAdmin,
  };

  const registeredUser = await createNewUser(user);
  return registeredUser;
};
