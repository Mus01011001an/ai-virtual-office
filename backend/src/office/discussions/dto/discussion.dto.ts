import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class StartDiscussionDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) participantIds: string[];
}
export class ParticipantsDto {
  @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) participantIds: string[];
}
export class MessageDto {
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
}
