import { type FastifyRequest, type FastifyReply } from 'fastify';
import * as authService from '../services/auth.service.js';
import type { userBody, loginBody } from '../routes/auth.routes.js';

const registerUser = async (
  request: FastifyRequest<{ Body: userBody }>,
  reply: FastifyReply,
) => {
  // user register
  // 1. Get the user from request.Body
  // 2. Validate everything, there are three fields email, name and password.
  // 3. Check if email has @, and all the values are present
  // 4. Then use bcrypt to hash the password
  // 5. Then use drizzle to add the user to the user table
  const { email, password, name } = request.body;

  const registeredUser = await authService.registerUser(
    email,
    password,
    name,
    false,
  );

  const [createdUser] = registeredUser;
  if (!createdUser) {
    return reply.conflict('User already exists');
  } else {
    return reply.code(201).send({
      email: createdUser.email,
      name: createdUser.name,
      isAdmin: createdUser.isAdmin,
    });
  }
};

const loginUser = async (
  request: FastifyRequest<{ Body: loginBody }>,
  reply: FastifyReply,
) => {
  const { email, password } = request.body;
  const payload = await authService.loginUser(email, password);

  if (payload === null) {
    return reply.unauthorized('Invalid email or password');
  }
  const token = await reply.jwtSign(payload);

  return reply.code(200).send({
    token: token,
    user: { isAdmin: payload.isAdmin },
  });
};

export { registerUser, loginUser };
