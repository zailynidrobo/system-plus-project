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
import { CreateAcademicModuleDto } from './dto/create-academic-module.dto.js';
import { UpdateAcademicModuleDto } from './dto/update-academic-module.dto.js';
import { CreateCompetencyDto } from './dto/create-competency.dto.js';
import { UpdateCompetencyDto } from './dto/update-competency.dto.js';
import { ConfigureGuideFieldsDto } from './dto/configure-guide-fields.dto.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';
import { UpdatePersonalizedGuideVersionDto } from './dto/update-personalized-guide-version.dto.js';
import { GuideDocumentExportService } from './guide-document-export.service.js';

@Controller('academic')
export class AcademicController {
  constructor(
    private readonly academicService: AcademicService,
    private readonly documentExportService: GuideDocumentExportService,
  ) {}

  @Post('modules')
  createModule(@Body() dto: CreateAcademicModuleDto) {
    return this.academicService.createModule(dto);
  }

  @Get('modules')
  findAllModules() {
    return this.academicService.findAllModules();
  }

  @Get('modules/:id')
  findModule(@Param('id') id: string) {
    return this.academicService.findModule(id);
  }

  @Patch('modules/:id')
  updateModule(@Param('id') id: string, @Body() dto: UpdateAcademicModuleDto) {
    return this.academicService.updateModule(id, dto);
  }

  @Patch('modules/:id/deactivate')
  deactivateModule(@Param('id') id: string) {
    return this.academicService.deactivateModule(id);
  }

  @Post('competencies')
  createCompetency(@Body() dto: CreateCompetencyDto) {
    return this.academicService.createCompetency(dto);
  }

  @Get('competencies')
  findAllCompetencies() {
    return this.academicService.findAllCompetencies();
  }

  @Get('competencies/:id')
  findCompetency(@Param('id') id: string) {
    return this.academicService.findCompetency(id);
  }

  @Patch('competencies/:id')
  updateCompetency(@Param('id') id: string, @Body() dto: UpdateCompetencyDto) {
    return this.academicService.updateCompetency(id, dto);
  }

  @Delete('competencies/:id')
  deleteCompetency(@Param('id') id: string) {
    return this.academicService.deleteCompetency(id);
  }

  @Post('modules/:moduleId/competencies/:competencyId')
  associateCompetency(
    @Param('moduleId') moduleId: string,
    @Param('competencyId') competencyId: string,
  ) {
    return this.academicService.associateCompetency(moduleId, competencyId);
  }

  @Delete('modules/:moduleId/competencies/:competencyId')
  disassociateCompetency(
    @Param('moduleId') moduleId: string,
    @Param('competencyId') competencyId: string,
  ) {
    return this.academicService.disassociateCompetency(moduleId, competencyId);
  }

  @Put('modules/:moduleId/guide-fields')
  @Roles('coordinador')
  configureModuleGuideFields(
    @Param('moduleId') moduleId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureModuleGuideFields(moduleId, dto);
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
  createGuide(@Body() dto: CreateGuideDto) {
    return this.academicService.createGuide(dto);
  }

  @Get('guides')
  @Roles('coordinador', 'docente')
  findAllGuides(
    @Query('moduleId') moduleId: string | undefined,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findGuidesForUser(
      moduleId,
      request.user.sub,
      request.user.realm_access?.roles ?? [],
    );
  }

  @Get('guides/:id')
  @Roles('coordinador', 'docente')
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
  @Roles('coordinador', 'docente')
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
  @Roles('coordinador', 'docente')
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
  @Roles('coordinador', 'docente')
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
  updateGuide(@Param('id') id: string, @Body() dto: UpdateGuideDto) {
    return this.academicService.updateGuide(id, dto);
  }

  @Patch('guides/:id/publish')
  @Roles('coordinador')
  publishGuide(@Param('id') id: string) {
    return this.academicService.publishGuide(id);
  }

  @Put('modules/:moduleId/teachers/:teacherId')
  @Roles('coordinador')
  assignTeacherToModule(
    @Param('moduleId') moduleId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.academicService.assignTeacherToModule(moduleId, teacherId);
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
  @Roles('docente')
  createPersonalizedVersion(
    @Param('guideId') guideId: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.createPersonalizedVersion(
      guideId,
      request.user.sub,
    );
  }

  @Get('personalized-versions')
  @Roles('docente')
  findMyPersonalizedVersions(@Req() request: { user: KeycloakJwtPayload }) {
    return this.academicService.findPersonalizedVersionsForTeacher(
      request.user.sub,
    );
  }

  @Get('personalized-versions/:id')
  @Roles('docente')
  findPersonalizedVersion(
    @Param('id') id: string,
    @Req() request: { user: KeycloakJwtPayload },
  ) {
    return this.academicService.findPersonalizedVersionForTeacher(
      id,
      request.user.sub,
    );
  }

  @Get('personalized-versions/:id/export')
  @Roles('docente')
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
  @Roles('docente')
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
}
