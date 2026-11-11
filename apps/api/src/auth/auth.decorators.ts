import { Reflector } from '@nestjs/core';
import type { UserRole } from '../db/entities/user.entity.js';

/** Маршрут доступен без входа. */
export const Public = Reflector.createDecorator<true>();

/** Маршрут доступен только перечисленным ролям. */
export const Roles = Reflector.createDecorator<UserRole[]>();
