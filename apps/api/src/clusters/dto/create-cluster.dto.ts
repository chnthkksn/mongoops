import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateClusterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(10)
  connectionString: string;

  @IsIn(['standalone', 'replicaSet'])
  topology: 'standalone' | 'replicaSet';
}
