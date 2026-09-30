import * as reservationService from '../services/reservation.service.js';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import type { CreateReservationBody } from '../routes/reservations.routes.js';

export const createReservation = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: CreateReservationBody;
  }>,
  reply: FastifyReply,
) => {
  const eventId = request.params.id;
  const { seatIds, idempotencyKey } = request.body;
  const userId = request.user.userId;

  try {
    const input: reservationService.CreateReservationInput = {
      eventId,
      userId,
      seatIds,
      idempotencyKey,
    };
    const result = await reservationService.createReservation(
      input,
      request.server.config.RESERVATION_LOCK_STRATEGY,
    );
    return reply.code(result.replayed ? 200 : 201).send({
      reservationId: result.reservationId,
      heldUntil: result.heldUntil,
    });
  } catch (err) {
    if (err instanceof reservationService.SeatsNotFoundError) {
      return reply.badRequest(err.message);
    }
    if (err instanceof reservationService.IdempotencyKeyReuseError) {
      return reply.unprocessableEntity(err.message);
    }
    if (err instanceof reservationService.SeatsUnavailableError) {
      return reply.conflict(err.message);
    }
    throw err;
  }
};

export const releaseReservation = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const reservationId = request.params.id;
  const userId = request.user.userId;

  try {
    await reservationService.releaseReservation({
      reservationId,
      userId,
    });
    return reply.code(204).send();
  } catch (err) {
    if (err instanceof reservationService.ReservationNotFoundError) {
      return reply.notFound(err.message);
    }
    if (err instanceof reservationService.ReservationNotReleasableError) {
      return reply.conflict(err.message);
    }
    throw err;
  }
};
