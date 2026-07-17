import { S3Client } from '@aws-sdk/client-s3';
import { StorageProvider } from './storage-provider.schema';
import { decryptSecret } from '../common/crypto.util';

export function buildS3Client(provider: StorageProvider): S3Client {
  return new S3Client({
    endpoint: provider.endpoint,
    region: provider.region,
    forcePathStyle: provider.forcePathStyle,
    credentials: {
      accessKeyId: provider.accessKeyId,
      secretAccessKey: decryptSecret(provider.encryptedSecretAccessKey),
    },
  });
}
