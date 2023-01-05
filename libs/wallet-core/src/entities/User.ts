import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column()
  public username: string;

  @Column()
  public email: string;

  @Column()
  public password: string;

  @Column({ name: 'full_name' })
  public fullName: string;

  @Column({ name: 'avatar_url' })
  public avatarUrl: string;
}
