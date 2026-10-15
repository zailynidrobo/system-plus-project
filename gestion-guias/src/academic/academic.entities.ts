export type GuideFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface GuideField {
  key: string;
  label: string;
  type: GuideFieldType;
  required: boolean;
  options?: string[];
  section?: string;
  description?: string;
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
}

export type GuideFormType = 'base' | 'teacher';
export type GuideStatus = 'draft' | 'published';
export type GuideContent = Record<string, unknown>;

export interface AcademicGuide {
  id: string;
  moduleId: string;
  moduleName: string;
  competencyId?: string;
  competencyName?: string;
  title: string;
  content: GuideContent;
  fields: GuideField[];
  status: GuideStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
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
