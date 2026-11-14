import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { AcademicService } from '../academic/academic.service.js';
import { GuideDocumentExportService } from '../academic/guide-document-export.service.js';
import { enviarDocumento } from '../academic/document-response.js';

/** HE-07 - Historial de versiones de una guía base: lista, consulta y descarga de versiones anteriores. */
@Controller('academic')
export class GuideHistoryController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly documentExportService: GuideDocumentExportService,
  ) {}

  @Get('guides/:id/versions')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findGuideVersions(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuideVersionsForUser(
      id,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id/versions/:version')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findGuideVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuideVersionForUser(
      id,
      version,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id/versions/:version/export')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  async exportGuideVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Query('format') format: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Res() response: Response,
  ) {
    await this.academicService.findGuideVersionForUser(
      id,
      version,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
    const data = await this.academicService.getGuideVersionDocumentData(
      id,
      version,
    );
    await enviarDocumento(this.documentExportService, data, format, `guia-${version}`, response);
  }
}
