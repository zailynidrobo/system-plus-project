import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '../../users/entities/user.entity.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { CompetenciesService } from '../services/competencies.service.js';
import { CompetencyTextDto } from '../dto/competency-text.dto.js';

@Controller()
export class CompetenciesController {
  constructor(private readonly competencies: CompetenciesService) {}

  /** HE-02-HU-04 */
  @Post('modules/:moduleId/competencies')
  @Roles(Role.COORDINADOR)
  create(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CompetencyTextDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.competencies.create(moduleId, dto, user);
  }

  @Get('modules/:moduleId/competencies')
  findByModule(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.competencies.findByModule(moduleId);
  }

  @Get('modules/:moduleId/competencies/next-code')
  @Roles(Role.COORDINADOR)
  previewNextCode(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.competencies.previewNextCode(moduleId);
  }

  @Get('competencies/:competencyId')
  findOne(@Param('competencyId', ParseUUIDPipe) competencyId: string) {
    return this.competencies.findOne(competencyId);
  }

  /** HE-02-HU-05 */
  @Patch('competencies/:competencyId')
  @Roles(Role.COORDINADOR)
  update(
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
    @Body() dto: CompetencyTextDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.competencies.update(competencyId, dto, user);
  }

  /** HE-02-HU-06 */
  @Delete('competencies/:competencyId')
  @Roles(Role.COORDINADOR)
  remove(
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.competencies.remove(competencyId, user);
  }

  @Get('competencies/:competencyId/history')
  getHistory(@Param('competencyId', ParseUUIDPipe) competencyId: string) {
    return this.competencies.getHistory(competencyId);
  }

  @Get('competencies/:competencyId/versions/:version')
  findVersion(
    @Param('competencyId', ParseUUIDPipe) competencyId: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.competencies.findVersion(competencyId, version);
  }
}
