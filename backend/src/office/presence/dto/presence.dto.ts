import { IsIn, IsNumber, IsOptional } from 'class-validator';

export class UpdatePresenceDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;

  @IsNumber()
  z!: number;

  @IsNumber()
  yaw!: number;

  @IsOptional()
  @IsIn(['idle', 'walk', 'run'])
  anim?: 'idle' | 'walk' | 'run';
}
