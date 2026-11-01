import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private users: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.deactivate(id, actor.id);
  }

  @Patch(':id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateRole(id, dto, actor.id);
  }
}
