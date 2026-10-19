# Inicialización idempotente del object storage local (LocalStack, etapa READY).
# Se ejecuta dentro del intérprete de LocalStack en cada arranque del contenedor: sin
# persistencia (plan gratuito) el estado de S3 se pierde al reiniciar y el bucket debe
# recrearse sin depender de un `docker compose up` posterior.
import os

import boto3

region = os.environ["S3_REGION"]
bucket = os.environ["S3_BUCKET_PACKAGES"]

s3 = boto3.client(
    "s3",
    endpoint_url="http://localhost:4566",
    region_name=region,
    aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
)

existing = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
if bucket not in existing:
    # us-east-1 es la única región que rechaza LocationConstraint explícito.
    if region == "us-east-1":
        s3.create_bucket(Bucket=bucket)
    else:
        s3.create_bucket(
            Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": region}
        )

# Los paquetes nunca son públicos: las descargas pasan por la API (URLs firmadas o proxy).
# Misma configuración que el bucket de producción en Amazon S3 (ADR 0002).
s3.put_public_access_block(
    Bucket=bucket,
    PublicAccessBlockConfiguration={
        "BlockPublicAcls": True,
        "IgnorePublicAcls": True,
        "BlockPublicPolicy": True,
        "RestrictPublicBuckets": True,
    },
)
print(f"Bucket '{bucket}' listo")
