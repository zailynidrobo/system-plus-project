import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AcademicService } from './academic.service.js';
import { CreateAcademicModuleDto } from './dto/create-academic-module.dto.js';
import { UpdateAcademicModuleDto } from './dto/update-academic-module.dto.js';
import { CreateCompetencyDto } from './dto/create-competency.dto.js';
import { UpdateCompetencyDto } from './dto/update-competency.dto.js';
import { ConfigureGuideFieldsDto } from './dto/configure-guide-fields.dto.js';
import { CreateGuideDto } from './dto/create-guide.dto.js';
import { UpdateGuideDto } from './dto/update-guide.dto.js';

@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

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
  configureModuleGuideFields(
    @Param('moduleId') moduleId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureModuleGuideFields(moduleId, dto);
  }

  @Put('modules/:moduleId/competencies/:competencyId/guide-fields')
  configureCompetencyGuideFields(
    @Param('moduleId') moduleId: string,
    @Param('competencyId') competencyId: string,
    @Body() dto: ConfigureGuideFieldsDto,
  ) {
    return this.academicService.configureCompetencyGuideFields(moduleId, competencyId, dto);
  }

  @Post('guides')
  createGuide(@Body() dto: CreateGuideDto) {
    return this.academicService.createGuide(dto);
  }

  @Get('guides')
  findAllGuides(@Query('moduleId') moduleId?: string) {
    return this.academicService.findAllGuides(moduleId);
  }

  @Get('guides/:id')
  findGuide(@Param('id') id: string) {
    return this.academicService.findGuide(id);
  }

  @Patch('guides/:id')
  updateGuide(@Param('id') id: string, @Body() dto: UpdateGuideDto) {
    return this.academicService.updateGuide(id, dto);
  }

  @Patch('guides/:id/publish')
  publishGuide(@Param('id') id: string) {
    return this.academicService.publishGuide(id);
  }
}
