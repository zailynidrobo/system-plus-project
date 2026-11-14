import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { AcademicService } from '../academic/academic.service.js';
import { GuideDocumentExportService } from '../academic/guide-document-export.service.js';
import { enviarDocumento } from '../academic/document-response.js';
import { CreatePersonalizedGuideVersionDto } from '../academic/dto/create-personalized-guide-version.dto.js';
import { UpdatePersonalizedGuideVersionDto } from '../academic/dto/update-personalized-guide-version.dto.js';

/** HE-04 - Espacio docente: módulos asignados y versiones personalizadas de las guías base. */
@Controller('academic')
export class TeacherSpaceController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly documentExportService: GuideDocumentExportService,
  ) {}

  @Post('guides/:guideId/personalized-versions')
  @Roles('docente', 'docente_autorizado')
  createPersonalizedVersion(
    @Param('guideId') guideId: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Body() dto?: CreatePersonalizedGuideVersionDto,
  ) {
    return this.academicService.createPersonalizedVersion(
      guideId,
      request.user.sub,
      dto?.name,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('my-assignments')
  @Roles('docente', 'docente_autorizado')
  findMyAssignments(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.findAssignmentsForTeacher(
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('personalized-versions')
  @Roles('docente', 'docente_autorizado')
  findMyPersonalizedVersions(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.findPersonalizedVersionsForTeacher(
      request.user.sub,
    );
  }

  @Get('personalized-versions/:id')
  @Roles('docente', 'docente_autorizado')
  findPersonalizedVersion(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findPersonalizedVersionForTeacher(
      id,
      request.user.sub,
    );
  }

  @Get('personalized-versions/:id/isolation')
  @Roles('docente', 'docente_autorizado')
  findPersonalizedVersionIsolation(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findPersonalizedVersionIsolation(
      id,
      request.user.sub,
    );
  }

  @Get('personalized-versions/:id/export')
  @Roles('docente', 'docente_autorizado')
  async exportPersonalizedVersion(
    @Param('id') id: string,
    @Query('format') format: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Res() response: Response,
  ) {
    const data = await this.academicService.getPersonalizedVersionDocumentData(
      id,
      request.user.sub,
    );
    await enviarDocumento(this.documentExportService, data, format, 'guia-docente', response);
  }

  @Patch('personalized-versions/:id')
  @Roles('docente', 'docente_autorizado')
  updatePersonalizedVersion(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Body() dto: UpdatePersonalizedGuideVersionDto,
  ) {
    return this.academicService.updatePersonalizedVersion(
      id,
      request.user.sub,
      dto,
    );
  }
}
