import { type FastifyPluginAsync } from 'fastify';
import * as userController from '../controllers/auth.controllers.js';

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

export interface userBody {
  email: string;
  password: string;
  name: string;
}

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: userBody }>(
    '/register',
    { schema: { body: userRegisterSchema } },
    userController.registerUser,
  );
};

export default userRoutes;
