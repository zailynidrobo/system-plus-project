import { MigrationInterface, QueryRunner } from 'typeorm';

export class EsquemaInicial1794754196150 implements MigrationInterface {
  name = 'EsquemaInicial1794754196150';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "academic_guides" ("id" uuid NOT NULL, "code" character varying(40), "moduleId" uuid NOT NULL, "moduleName" character varying(150) NOT NULL, "competencyId" uuid, "competencyName" text, "title" character varying(250) NOT NULL, "content" jsonb NOT NULL, "fields" jsonb NOT NULL, "structureVersion" integer NOT NULL DEFAULT '1', "version" character varying(20) NOT NULL DEFAULT 'v0', "status" character varying(20) NOT NULL DEFAULT 'draft', "createdById" character varying(100), "createdByName" character varying(150), "updatedById" character varying(100), "updatedByName" character varying(150), "publishedById" character varying(100), "publishedByName" character varying(150), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9dca6582da857c4b05416d1087c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_guides_code" ON "academic_guides"  ("code") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guides_module" ON "academic_guides"  ("moduleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_guide_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guideId" uuid NOT NULL, "version" character varying(20) NOT NULL, "status" character varying(20) NOT NULL, "description" character varying(500) NOT NULL, "authorId" character varying(100), "authorName" character varying(150), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "isPublication" boolean NOT NULL, "structureVersion" integer NOT NULL, "fields" jsonb NOT NULL, "content" jsonb NOT NULL, "publishedAt" TIMESTAMP WITH TIME ZONE, "publishedById" character varying(100), "publishedByName" character varying(150), CONSTRAINT "PK_ed8b6aefae77101a85be5c5ae11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_versions_guide_created" ON "academic_guide_versions"  ("guideId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_guide_versions_guide_version" ON "academic_guide_versions"  ("guideId", "version") `,
    );
    await queryRunner.query(
      `CREATE TABLE "guide_edit_locks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(150) NOT NULL, "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "reason" character varying(500) NOT NULL, "createdById" character varying(100) NOT NULL, "createdByName" character varying(150) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_d0e46306a905b5320a24e71a0c7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_edit_locks_dates" ON "guide_edit_locks"  ("startsAt", "endsAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_guide_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guideId" uuid NOT NULL, "title" character varying(250) NOT NULL, "authorId" character varying(100) NOT NULL, "authorName" character varying(150) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7ea2ac1dfe56a110c49e89f0b01" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_events_guide_created" ON "academic_guide_events"  ("guideId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_guide_field_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "moduleId" uuid NOT NULL, "competencyId" uuid, "formType" character varying(20) NOT NULL, "fields" jsonb NOT NULL, "version" integer NOT NULL DEFAULT '1', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_208daa5ae5dd947c89335b33cca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_field_configs_lookup" ON "academic_guide_field_configs"  ("moduleId", "competencyId", "formType") `,
    );
    await queryRunner.query(
      `CREATE TABLE "guide_support_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "guideId" uuid NOT NULL, "fileName" character varying(255) NOT NULL, "contentType" character varying(100) NOT NULL, "size" integer NOT NULL, "data" bytea NOT NULL, "uploadedById" character varying(100), "uploadedByName" character varying(150), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_86b7901830a53342559e914755a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guide_support_materials_guide" ON "guide_support_materials"  ("guideId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_module_teacher_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "moduleId" uuid NOT NULL, "teacherId" character varying(255) NOT NULL, CONSTRAINT "PK_6679be55abaa7704f2a011267d4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_module_teacher_assignments_teacher" ON "academic_module_teacher_assignments"  ("teacherId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_module_teacher_assignments_pair" ON "academic_module_teacher_assignments"  ("moduleId", "teacherId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_personalized_guide_versions" ("id" uuid NOT NULL, "baseGuideId" uuid NOT NULL, "moduleId" uuid NOT NULL, "moduleName" character varying(150) NOT NULL, "teacherId" character varying(255) NOT NULL, "title" character varying(250) NOT NULL, "name" character varying(150), "baseContent" jsonb NOT NULL, "baseFields" jsonb NOT NULL, "content" jsonb NOT NULL, "fields" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_4ea07cbf92e2ec1d5f6726dc517" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_personalized_versions_teacher" ON "academic_personalized_guide_versions"  ("teacherId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "programs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(10) NOT NULL, "name" character varying(150) NOT NULL, "campus" character varying(150), "cohort" integer, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_11924ca2e0cb47a8d9400bada03" UNIQUE ("code"), CONSTRAINT "PK_d43c664bcaafc0e8a06dfd34e05" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."curricular_modules_status_enum" AS ENUM('draft', 'active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TABLE "curricular_modules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "programId" uuid NOT NULL, "code" character varying(30) NOT NULL, "sequence" integer NOT NULL, "name" character varying(150) NOT NULL, "normalizedName" character varying(150) NOT NULL, "description" text, "status" "public"."curricular_modules_status_enum" NOT NULL DEFAULT 'active', "competencyPrefix" character varying(10) NOT NULL, "competencySequence" integer NOT NULL DEFAULT '0', "guideSequence" integer NOT NULL DEFAULT '0', "createdById" character varying(100) NOT NULL, "createdByName" character varying(150) NOT NULL, "updatedById" character varying(100), "updatedByName" character varying(150), "inactivatedAt" TIMESTAMP WITH TIME ZONE, "inactivatedById" character varying(100), "inactivatedByName" character varying(150), "inactivationReason" character varying(500), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_33b63c86588e5a13cd809bec866" UNIQUE ("code"), CONSTRAINT "PK_41cbbd50b88807c1b81d0d9aec2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_curricular_modules_program_prefix" ON "curricular_modules"  ("programId", "competencyPrefix") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_curricular_modules_program_sequence" ON "curricular_modules"  ("programId", "sequence") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_curricular_modules_program_name" ON "curricular_modules"  ("programId", "normalizedName") `,
    );
    await queryRunner.query(
      `CREATE TABLE "competencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "moduleId" uuid NOT NULL, "code" character varying(30) NOT NULL, "sequence" integer NOT NULL, "text" text NOT NULL, "normalizedText" text NOT NULL, "version" integer NOT NULL DEFAULT '1', "createdById" character varying(100) NOT NULL, "createdByName" character varying(150) NOT NULL, "updatedById" character varying(100), "updatedByName" character varying(150), "deletedById" character varying(100), "deletedByName" character varying(150), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_0b29ecda233cc61de0d93527813" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_competencies_module_sequence" ON "competencies"  ("moduleId", "sequence") `,
    );
    await queryRunner.query(
      `CREATE TABLE "competency_revisions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "competencyId" uuid NOT NULL, "version" integer NOT NULL, "text" text NOT NULL, "editedById" character varying(100) NOT NULL, "editedByName" character varying(150) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_af13089aede1ad8e974899976e0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_competency_revisions_version" ON "competency_revisions"  ("competencyId", "version") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_events" ("id" uuid NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "actorId" character varying(255), "actorName" character varying(150), "actorEmail" character varying(254), "actorRole" character varying(30), "method" character varying(10) NOT NULL, "route" character varying(250) NOT NULL, "path" character varying(500) NOT NULL, "area" character varying(60) NOT NULL, "action" character varying(150) NOT NULL, "result" character varying(10) NOT NULL, "statusCode" integer NOT NULL, "ip" character varying(45), "userAgent" character varying(300), "entityType" character varying(30), "entityId" character varying(255), "entityLabel" character varying(300), "moduleId" uuid, "moduleName" character varying(150), "details" jsonb, CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_result" ON "audit_events"  ("result") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_area" ON "audit_events"  ("area") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_module" ON "audit_events"  ("moduleId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_actor" ON "audit_events"  ("actorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_events_occurred_at" ON "audit_events"  ("occurredAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "academic_guide_suggestions" ("id" uuid NOT NULL, "sequence" integer NOT NULL, "code" character varying(20) NOT NULL, "guideId" uuid NOT NULL, "moduleId" uuid NOT NULL, "fieldKey" character varying(100) NOT NULL, "fieldLabel" character varying(250) NOT NULL, "teacherId" character varying(255) NOT NULL, "teacherName" character varying(150) NOT NULL, "currentValue" jsonb, "proposedValue" jsonb, "justification" text NOT NULL, "neededBy" date, "baseVersion" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "dueSoonAt" TIMESTAMP WITH TIME ZONE NOT NULL, "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL, "decidedAt" TIMESTAMP WITH TIME ZONE, "decidedById" character varying(255), "decidedByName" character varying(150), "rejectReason" character varying(250), "feedback" text, "resultingVersion" character varying(20), CONSTRAINT "PK_955efa597039b54a82e3dfdd3c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_guide_suggestions_pending_field" ON "academic_guide_suggestions"  ("guideId", "teacherId", "fieldKey") WHERE "status" = 'pending'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_suggestions_teacher" ON "academic_guide_suggestions"  ("teacherId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_suggestions_guide" ON "academic_guide_suggestions"  ("guideId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_academic_guide_suggestions_status" ON "academic_guide_suggestions"  ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_guide_suggestions_sequence" ON "academic_guide_suggestions"  ("sequence") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_academic_guide_suggestions_code" ON "academic_guide_suggestions"  ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "suggestion_settings" ("id" character varying(20) NOT NULL, "dueBusinessDays" integer NOT NULL, "dueSoonBusinessDays" integer NOT NULL, "updatedById" character varying(100) NOT NULL, "updatedByName" character varying(150) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b67f64e9c3aef66bf7e098b97f2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_notifications" ("id" uuid NOT NULL, "recipientId" character varying(255) NOT NULL, "type" character varying(40) NOT NULL, "title" character varying(250) NOT NULL, "message" text NOT NULL, "guideId" uuid, "suggestionId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_569622b0fd6e6ab3661de985a2b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notifications_recipient_created" ON "user_notifications"  ("recipientId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "curricular_modules" ADD CONSTRAINT "FK_e295263af182a852b1ef891a5dd" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "competencies" ADD CONSTRAINT "FK_2339b6f5bae679290de37d220bd" FOREIGN KEY ("moduleId") REFERENCES "curricular_modules"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "competency_revisions" ADD CONSTRAINT "FK_ede01d21a909e8275d58df5b689" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "competency_revisions" DROP CONSTRAINT "FK_ede01d21a909e8275d58df5b689"`,
    );
    await queryRunner.query(
      `ALTER TABLE "competencies" DROP CONSTRAINT "FK_2339b6f5bae679290de37d220bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "curricular_modules" DROP CONSTRAINT "FK_e295263af182a852b1ef891a5dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notifications_recipient_created"`,
    );
    await queryRunner.query(`DROP TABLE "user_notifications"`);
    await queryRunner.query(`DROP TABLE "suggestion_settings"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_academic_guide_suggestions_code"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_academic_guide_suggestions_sequence"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_suggestions_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_suggestions_guide"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_suggestions_teacher"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_academic_guide_suggestions_pending_field"`,
    );
    await queryRunner.query(`DROP TABLE "academic_guide_suggestions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_events_occurred_at"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_actor"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_module"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_area"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_events_result"`);
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_competency_revisions_version"`,
    );
    await queryRunner.query(`DROP TABLE "competency_revisions"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_competencies_module_sequence"`,
    );
    await queryRunner.query(`DROP TABLE "competencies"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_curricular_modules_program_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_curricular_modules_program_sequence"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_curricular_modules_program_prefix"`,
    );
    await queryRunner.query(`DROP TABLE "curricular_modules"`);
    await queryRunner.query(
      `DROP TYPE "public"."curricular_modules_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "programs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_personalized_versions_teacher"`,
    );
    await queryRunner.query(
      `DROP TABLE "academic_personalized_guide_versions"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_academic_module_teacher_assignments_pair"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_module_teacher_assignments_teacher"`,
    );
    await queryRunner.query(`DROP TABLE "academic_module_teacher_assignments"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guide_support_materials_guide"`,
    );
    await queryRunner.query(`DROP TABLE "guide_support_materials"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_field_configs_lookup"`,
    );
    await queryRunner.query(`DROP TABLE "academic_guide_field_configs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_events_guide_created"`,
    );
    await queryRunner.query(`DROP TABLE "academic_guide_events"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guide_edit_locks_dates"`);
    await queryRunner.query(`DROP TABLE "guide_edit_locks"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_academic_guide_versions_guide_version"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_academic_guide_versions_guide_created"`,
    );
    await queryRunner.query(`DROP TABLE "academic_guide_versions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_academic_guides_module"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_academic_guides_code"`);
    await queryRunner.query(`DROP TABLE "academic_guides"`);
  }
}
