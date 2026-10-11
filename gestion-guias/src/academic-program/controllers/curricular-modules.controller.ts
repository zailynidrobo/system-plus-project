import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../../users/entities/user.entity.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { CurricularModulesService } from '../services/curricular-modules.service.js';
import { CreateCurricularModuleDto } from '../dto/create-curricular-module.dto.js';
import { UpdateCurricularModuleDto } from '../dto/update-curricular-module.dto.js';
import { DeactivateCurricularModuleDto } from '../dto/deactivate-curricular-module.dto.js';
import { ListCurricularModulesQuery } from '../dto/list-curricular-modules.query.js';
import { NameAvailabilityQuery } from '../dto/name-availability.query.js';

@Controller()
export class CurricularModulesController {
  constructor(private readonly modules: CurricularModulesService) {}

  /** HE-02-HU-01 */
  @Post('programs/:programId/modules')
  @Roles(Role.COORDINADOR)
  create(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: CreateCurricularModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modules.create(programId, dto, user);
  }

  @Get('programs/:programId/modules')
  findAll(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Query() query: ListCurricularModulesQuery,
  ) {
    return this.modules.findAll(programId, query);
  }

  @Get('programs/:programId/modules/name-availability')
  @Roles(Role.COORDINADOR)
  checkNameAvailability(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Query() query: NameAvailabilityQuery,
  ) {
    return this.modules.checkNameAvailability(programId, query);
  }

  @Get('modules/:moduleId')
  findOne(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.modules.findOne(moduleId);
  }

  /** HE-02-HU-02 */
  @Patch('modules/:moduleId')
  @Roles(Role.COORDINADOR)
  update(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UpdateCurricularModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modules.update(moduleId, dto, user);
  }

  @Patch('modules/:moduleId/register')
  @Roles(Role.COORDINADOR)
  register(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modules.register(moduleId, user);
  }

  /** HE-02-HU-03 */
  @Patch('modules/:moduleId/deactivate')
  @Roles(Role.COORDINADOR)
  deactivate(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: DeactivateCurricularModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modules.deactivate(moduleId, dto, user);
  }

  @Patch('modules/:moduleId/reactivate')
  @Roles(Role.COORDINADOR)
  reactivate(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modules.reactivate(moduleId, user);
  }
}
