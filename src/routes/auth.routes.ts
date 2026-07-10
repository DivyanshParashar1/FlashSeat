import { type FastifyPluginAsync } from 'fastify';
import * as authController from '../controllers/auth.controllers.js';

const userRegisterSchema = {
  type: 'object',
  required: ['email', 'password', 'name'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', minLength: 8, maxLength: 72 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
  },
};

const userLoginSchema = {
  type: 'object',
  required: ['email', 'password'],
  additionalProperties: false,
  properties: {
    email: { type: 'string', format: 'email', maxLength: 255 },
    password: { type: 'string', minLength: 0, maxLength: 72 },
  },
};

export interface userBody {
  email: string;
  password: string;
  name: string;
}
export interface loginBody {
  email: string;
  password: string;
}

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: userBody }>(
    '/register',
    { schema: { body: userRegisterSchema } },
    authController.registerUser,
  );
  fastify.post<{ Body: loginBody }>(
    '/login',
    { schema: { body: userLoginSchema } },
    authController.loginUser,
  );
};

export default userRoutes;
