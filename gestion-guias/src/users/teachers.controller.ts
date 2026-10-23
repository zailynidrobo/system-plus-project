import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { UsersService } from './users.service.js';

/** Lista de docentes para que coordinación los asigne a módulos (HE-04). El resto de /users es solo del admin. */
@Controller('academic/teachers')
@Roles('coordinador')
export class TeachersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findTeachers();
  }
}
