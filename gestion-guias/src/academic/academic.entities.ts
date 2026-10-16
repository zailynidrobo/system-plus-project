export type GuideFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface GuideField {
  key: string;
  label: string;
  type: GuideFieldType;
  required: boolean;
  options?: string[];
  section?: string;
  description?: string;
  help?: string;
  maxLength?: number;
  teacherEditable?: boolean;
}

export interface AcademicModule {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  competencyIds: string[];
}

export interface Competency {
  id: string;
  name: string;
  description?: string;
}

export interface GuideFieldConfig {
  moduleId: string;
  competencyId?: string;
  formType: GuideFormType;
  fields: GuideField[];
  version: number;
  updatedAt: string;
}

export type GuideFormType = 'base' | 'teacher';
export type GuideStatus = 'draft' | 'published';
export type GuideContent = Record<string, unknown>;

export interface AcademicGuide {
  id: string;
  code: string;
  moduleId: string;
  moduleName: string;
  competencyId?: string;
  competencyName?: string;
  competencyDeleted: boolean;
  title: string;
  content: GuideContent;
  fields: GuideField[];
  structureVersion: number;
  version: string;
  status: GuideStatus;
  createdBy?: GuideActor;
  updatedBy?: GuideActor;
  publishedBy?: GuideActor;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface GuideActor {
  id: string;
  name: string;
}

export interface GuideEvent {
  id: string;
  guideId: string;
  title: string;
  author: GuideActor;
  createdAt: string;
}

export interface PersonalizedGuideVersion {
  id: string;
  baseGuideId: string;
  moduleId: string;
  moduleName: string;
  teacherId: string;
  title: string;
  baseContent: GuideContent;
  baseFields: GuideField[];
  content: GuideContent;
  fields: GuideField[];
  createdAt: string;
  updatedAt: string;
}
