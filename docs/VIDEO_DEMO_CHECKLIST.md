# Video Demo Checklist (< 3 min)

## Before recording

```bash
# Terminal 1
npm run dev

# Terminal 2
./scripts/start-adk-agent.sh

# Terminal 3 (optional dev-ui)
./scripts/start-adk-local.sh

# Pre-warm
curl -s "http://localhost:3000/api/agent/search?q=ICBF" > /dev/null
curl -s http://localhost:3000/api/system/compliance | jq .
```

## Record these 4 proofs

1. **Gemini** — Configuración → Gemini operational, or `analisisIA.meta.engine: "adk"` / `"gemini"` in results
2. **ADK Agent** — `curl http://localhost:8080/health` → `geminiConfigured: true`
3. **Elastic MCP** — compliance `elasticMcp: true` OR results `elasticInsights.retrievalMethod: "elastic-agent-builder-mcp"`
4. **Production** — `curl https://neuraudit.vercel.app/api/system/compliance` (after deploy)

## Demo script (90 sec)

1. Open app → tech strip shows runtime status (green = ok)
2. View Demo → ICBF → Executive Dashboard + evidence hits
3. Show IA panel (ADK/Gemini engine)
4. Terminal: `curl /api/system/compliance` JSON
5. Optional: ADK dev-ui at `:8000/dev-ui/?app=neuraudit_agent&userId=user`
