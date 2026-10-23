import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { KeycloakJwtPayload } from '../auth/keycloak.strategy.js';
import { AcademicService } from './academic.service.js';
import { ConfigureGuideFieldsDto } from './dto/configure-guide-fields.dto.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';
import { CreatePersonalizedGuideVersionDto } from './dto/create-personalized-guide-version.dto.js';
import { UpdatePersonalizedGuideVersionDto } from './dto/update-personalized-guide-version.dto.js';
import { GuideDocumentExportService } from './guide-document-export.service.js';
import { GuideFieldsImpactDto } from './dto/guide-fields-impact.dto.js';
import { ListGuidesQuery } from './dto/list-guides.query.js';

@Controller('academic')
export class AcademicController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly documentExportService: GuideDocumentExportService,
  ) {}

  @Put('modules/:moduleId/guide-fields')
  @Roles('coordinador')
  configureModuleGuideFields(
    @Param('moduleId') moduleId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureModuleGuideFields(moduleId, dto);
  }

  @Get('modules/:moduleId/guide-fields')
  @Roles('coordinador')
  getBaseGuideFields(
    @Param('moduleId') moduleId: string,
    @Query('competencyId') competencyId: string | undefined,
  ) {
    return this.academicService.getBaseGuideFields(moduleId, competencyId);
  }

  @Post('modules/:moduleId/guide-fields/impact')
  @Roles('coordinador')
  getBaseGuideFieldsImpact(
    @Param('moduleId') moduleId: string,
    @Body() dto: GuideFieldsImpactDto,
  ) {
    return this.academicService.getBaseGuideFieldsImpact(
      moduleId,
      dto.competencyId,
    );
  }

  @Get('modules/:moduleId/guides/next-code')
  @Roles('coordinador')
  previewNextGuideCode(@Param('moduleId') moduleId: string) {
    return this.academicService.previewNextGuideCode(moduleId);
  }

  @Put('modules/:moduleId/teacher-guide-fields')
  @Roles('coordinador')
  configureTeacherGuideFields(
    @Param('moduleId') moduleId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureTeacherGuideFields(moduleId, dto);
  }

  @Put('modules/:moduleId/competencies/:competencyId/guide-fields')
  @Roles('coordinador')
  configureCompetencyGuideFields(
    @Param('moduleId') moduleId: string,
    @Param('competencyId') competencyId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureCompetencyGuideFields(
      moduleId,
      competencyId,
      dto,
    );
  }

  @Post('guides')
  @Roles('coordinador')
  createGuide(
    @Body() dto: CreateGuideDto,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.createGuide(dto, this.guideActor(request.user));
  }

  @Get('guides')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findAllGuides(
    @Query() query: ListGuidesQuery,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuidesForUser(
      query,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/summary')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  getGuidesSummary(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.getGuidesSummaryForUser(
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findGuide(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuideForUser(
      id,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id/events')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findGuideEvents(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuideEventsForUser(
      id,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Post('guides/:id/support-materials')
  @Roles('coordinador')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  addGuideSupportMaterial(
    @Param('id') id: string,
    @UploadedFile()
    file:
      | {
          originalname: string;
          mimetype: string;
          buffer: Buffer;
          size: number;
        }
      | undefined,
  ) {
    if (!file)
      throw new BadRequestException('Adjunta un archivo en el campo file');
    return this.academicService.addGuideSupportMaterial(id, file);
  }

  @Get('guides/:id/support-materials')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  findGuideSupportMaterials(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuideSupportMaterialsForUser(
      id,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id/support-materials/:materialId/download')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  async downloadGuideSupportMaterial(
    @Param('id') id: string,
    @Param('materialId') materialId: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Res() response: Response,
  ) {
    const material = await this.academicService.getGuideSupportMaterialForUser(
      id,
      materialId,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
    response.setHeader('Content-Type', material.contentType);
    response.attachment(material.fileName).send(material.data);
  }

  @Get('guides/:id/export')
  @Roles('coordinador', 'docente', 'docente_autorizado')
  async exportGuide(
    @Param('id') id: string,
    @Query('format') format: string,
    @Req() request: { user: KeycloakJwtPayload },
    @Res() response: Response,
  ) {
    await this.academicService.findGuideForUser(
      id,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
    const data = await this.academicService.getGuideDocumentData(id);
    const file = await this.exportDocument(data, format);
    const extension = this.documentExtension(format);
    response.setHeader('Content-Type', this.documentContentType(extension));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="guia-base.${extension}"`,
    );
    response.send(file);
  }

  @Patch('guides/:id')
  @Roles('coordinador')
  updateGuide(
    @Param('id') id: string,
    @Body() dto: UpdateGuideDto,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.updateGuide(
      id,
      dto,
      this.guideActor(request.user),
    );
  }

  @Patch('guides/:id/publish')
  @Roles('coordinador')
  publishGuide(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.publishGuide(id, this.guideActor(request.user));
  }

  @Put('modules/:moduleId/teachers/:teacherId')
  @Roles('coordinador')
  assignTeacherToModule(
    @Param('moduleId') moduleId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.academicService.assignTeacherToModule(moduleId, teacherId);
  }

  @Get('modules/:moduleId/teachers')
  @Roles('coordinador')
  findAssignedTeacherIds(@Param('moduleId') moduleId: string) {
    return this.academicService.findAssignedTeacherIds(moduleId);
  }

  @Delete('modules/:moduleId/teachers/:teacherId')
  @Roles('coordinador')
  unassignTeacherFromModule(
    @Param('moduleId') moduleId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.academicService.unassignTeacherFromModule(moduleId, teacherId);
  }

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
    );
  }

  @Get('my-assignments')
  @Roles('docente', 'docente_autorizado')
  findMyAssignments(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.findAssignmentsForTeacher(request.user.sub);
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
    const file = await this.exportDocument(data, format);
    const extension = this.documentExtension(format);
    response.setHeader('Content-Type', this.documentContentType(extension));
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="guia-docente.${extension}"`,
    );
    response.send(file);
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

  private exportDocument(
    data: Awaited<ReturnType<AcademicService['getGuideDocumentData']>>,
    format: string,
  ) {
    if (format === 'docx') return this.documentExportService.toDocx(data);
    if (format === 'pdf') return this.documentExportService.toPdf(data);
    throw new BadRequestException('El formato debe ser docx o pdf');
  }

  private documentExtension(format: string): 'docx' | 'pdf' {
    if (format === 'docx' || format === 'pdf') return format;
    throw new BadRequestException('El formato debe ser docx o pdf');
  }

  private documentContentType(extension: 'docx' | 'pdf') {
    return extension === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  private guideActor(user: KeycloakJwtPayload) {
    return {
      id: user.sub,
      name: user.preferred_username ?? user.email ?? user.sub,
    };
  }
}
