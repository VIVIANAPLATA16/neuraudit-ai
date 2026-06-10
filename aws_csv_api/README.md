# NeurAudit CSV API (AWS Lambda)

FastAPI service behind API Gateway for S3 CSV preview/filter. Used by `/bases-datos` in the NeurAudit web app.

## CORS

Browser requests from Cloud Run or localhost require `CORSMiddleware` in `main.py` **and** correct API Gateway configuration.

### FastAPI (already in `main.py`)

Allowed origins include:

- `http://localhost:3000`
- `https://neuraudit-web-njc5h5wgjq-uc.a.run.app`
- `https://neuraudit.vercel.app`

Add more via Lambda env: `CORS_ALLOWED_ORIGINS=https://other.example.com`

## API Gateway — CORS checklist (production)

You must configure CORS **in both places** when API Gateway sits in front of Lambda:

### HTTP API (v2)

1. API Gateway → your API → **CORS**
2. **Access-Control-Allow-Origin**: add  
   `https://neuraudit-web-njc5h5wgjq-uc.a.run.app`, `http://localhost:3000`
3. **Access-Control-Allow-Methods**: `GET, OPTIONS`
4. **Access-Control-Allow-Headers**: `Content-Type, Authorization, Accept`
5. Save and **Deploy** the stage (e.g. `$default` or `prod`)

### REST API (v1)

1. Select resource `/csv` or `{proxy+}`
2. **Actions → Enable CORS**
3. Gateway Responses: ensure **DEFAULT 4XX/5XX** include CORS headers if Lambda errors before FastAPI runs
4. Add explicit **OPTIONS** method (mock integration) if preflight fails:
   - Integration type: Mock
   - Method response: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
5. **Deploy API** to production stage

### Common pitfall

If only Lambda returns CORS headers but API Gateway does not answer **OPTIONS** preflight, the browser still blocks the request. Enable CORS on the API **or** route `OPTIONS` to the same Lambda (Mangum handles OPTIONS when CORSMiddleware is active).

## Environment variables (Lambda)

| Variable | Description |
|----------|-------------|
| `CSV_S3_BUCKET` | S3 bucket name |
| `CSV_S3_KEY` | Object key (default `contratos.csv`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated extra origins |

## Local test

```bash
cd aws_csv_api
pip install -r requirements.txt
export CSV_S3_BUCKET=your-bucket
uvicorn main:app --reload --port 9000
curl -H "Origin: http://localhost:3000" http://127.0.0.1:9000/csv/preview?limit=5 -i
```

Look for `access-control-allow-origin` in response headers.

## Redeploy Lambda

After updating `main.py`, rebuild the deployment package and publish a new Lambda version, then ensure API Gateway stage is deployed.
