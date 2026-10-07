export type GuideFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface GuideField {
  key: string;
  label: string;
  type: GuideFieldType;
  required: boolean;
  options?: string[];
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
  fields: GuideField[];
}

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
