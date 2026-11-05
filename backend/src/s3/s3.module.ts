import { Module, Global } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';

@Global()
@Module({
  controllers: [S3Controller],
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: () => {
        return new S3Client({
          region: String(process.env.S3_REGION),
          endpoint: String(process.env.S3_ENDPOINT),
          forcePathStyle: true,
          credentials: {
            accessKeyId: String(process.env.S3_ACCESS_KEY),
            secretAccessKey: String(process.env.S3_SECRET_KEY),
          },
        });
      },
    },
    S3Service,
  ],
  exports: ['S3_CLIENT', S3Service],
})
export class S3Module {}
