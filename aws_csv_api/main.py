"""
NeurAudit CSV API — FastAPI on AWS Lambda (API Gateway + S3).

Endpoints consumed by /bases-datos:
  GET /csv/preview?limit=
  GET /csv/filter?column=&value=&mode=&limit=&offset=

Deploy: API Gateway (HTTP or REST) + Lambda (Mangum handler).
"""
from __future__ import annotations

import csv
import io
import os
from typing import Any

import boto3
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

SERVICE_VERSION = "1.1.0"

# --- CORS: browser clients (Cloud Run, Vercel, local dev) ---
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://neuraudit-web-njc5h5wgjq-uc.a.run.app",
    "https://neuraudit.vercel.app",
]

_extra_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = DEFAULT_ALLOWED_ORIGINS + [
    origin.strip() for origin in _extra_origins.split(",") if origin.strip()
]

app = FastAPI(
    title="NeurAudit CSV S3 API",
    version=SERVICE_VERSION,
    description="Preview and filter SECOP CSV stored in S3",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

S3_BUCKET = os.environ.get("CSV_S3_BUCKET", "")
S3_KEY = os.environ.get("CSV_S3_KEY", "contratos.csv")


def _s3_client():
    return boto3.client("s3")


def _load_csv_rows() -> list[dict[str, str]]:
    if not S3_BUCKET:
        raise HTTPException(status_code=503, detail="CSV_S3_BUCKET not configured")
    obj = _s3_client().get_object(Bucket=S3_BUCKET, Key=S3_KEY)
    body = obj["Body"].read().decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(body))
    return [dict(row) for row in reader]


def _filter_rows(
    rows: list[dict[str, str]],
    column: str,
    value: str,
    mode: str = "contains",
) -> list[dict[str, str]]:
    value_norm = value.strip().lower()
    if not value_norm:
        return rows
    matched: list[dict[str, str]] = []
    for row in rows:
        cell = str(row.get(column, "")).lower()
        if mode == "exact" and cell == value_norm:
            matched.append(row)
        elif mode == "startswith" and cell.startswith(value_norm):
            matched.append(row)
        elif mode == "contains" and value_norm in cell:
            matched.append(row)
    return matched


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "neuraudit-csv-api",
        "version": SERVICE_VERSION,
        "cors_origins": ALLOWED_ORIGINS,
    }


@app.get("/csv/preview")
def csv_preview(limit: int = Query(default=12, ge=1, le=500)) -> dict[str, Any]:
    rows = _load_csv_rows()
    preview = rows[:limit]
    return {
        "rows": preview,
        "total_rows": len(rows),
        "limit": limit,
        "offset": 0,
    }


@app.get("/csv/filter")
def csv_filter(
    column: str = Query(..., min_length=1),
    value: str = Query(default=""),
    mode: str = Query(default="contains"),
    limit: int = Query(default=12, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    rows = _load_csv_rows()
    filtered = _filter_rows(rows, column=column, value=value, mode=mode)
    page = filtered[offset : offset + limit]
    return {
        "rows": page,
        "total_matches": len(filtered),
        "total_rows": len(rows),
        "column": column,
        "value": value,
        "mode": mode,
        "limit": limit,
        "offset": offset,
    }


# AWS Lambda entrypoint (API Gateway proxy integration)
handler = Mangum(app, lifespan="off")
