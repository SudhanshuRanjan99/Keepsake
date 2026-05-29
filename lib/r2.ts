

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnvironmentVariable(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not defined.`);
  }

  return value;
}

function getR2Client() {
  const accountId = requireEnvironmentVariable("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironmentVariable("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironmentVariable("R2_SECRET_ACCESS_KEY");

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function getBucketName() {
  return requireEnvironmentVariable("R2_BUCKET_NAME");
}

type UploadPrivateObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export async function uploadPrivateObject({
  key,
  body,
  contentType,
}: UploadPrivateObjectInput) {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getPrivateObjectUrl(key: string) {
  const client = getR2Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
    {
      expiresIn: 900,
    },
  );
}

export async function downloadPrivateObject(key: string) {
  const client = getR2Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Private object body was not returned from R2.");
  }

  const bytes = await response.Body.transformToByteArray();

  return Buffer.from(bytes);
}

export async function deletePrivateObject(key: string) {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );
}