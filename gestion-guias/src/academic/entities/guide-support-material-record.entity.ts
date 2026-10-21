import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('guide_support_materials')
@Index('IDX_guide_support_materials_guide', ['guideId'])
export class GuideSupportMaterialRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  guideId: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 100 })
  contentType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'bytea', select: false })
  data: Buffer;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
