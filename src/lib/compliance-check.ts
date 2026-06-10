import { getGeminiApiKey, NEURAUDIT_GEMINI_MODEL } from "./gemini-config"
import { probeElasticMcp, isElasticMcpConfigured } from "./elastic-mcp-client"
import { getAdkAgentHealth, shouldSkipAdkAgent } from "./adk-agent-client"
import { getADKHealth } from "./adk-client"

export interface ComplianceStatus {
  gemini: boolean
  agentBuilder: boolean
  elasticMcp: boolean
  adkAgent: boolean
  timestamp: string
  details: {
    geminiModel: string
    elasticMcpConfigured: boolean
    elasticMcpTools: string[]
    adkAgentUrl: string | null
    adkAnalyzeConnected: boolean
  }
}

export async function runComplianceChecks(): Promise<ComplianceStatus> {
  const gemini = !!getGeminiApiKey()

  const elasticProbe = await probeElasticMcp()
  const elasticMcp = elasticProbe.reachable

  const adkHealth = await getAdkAgentHealth()
  const adkAgent = adkHealth.connected && adkHealth.geminiConfigured === true

  const analyzeHealth = shouldSkipAdkAgent() ? { connected: false } : await getADKHealth()

  const agentBuilder = adkAgent && elasticMcp

  return {
    gemini,
    agentBuilder,
    elasticMcp,
    adkAgent,
    timestamp: new Date().toISOString(),
    details: {
      geminiModel: NEURAUDIT_GEMINI_MODEL,
      elasticMcpConfigured: isElasticMcpConfigured(),
      elasticMcpTools: elasticProbe.tools,
      adkAgentUrl: shouldSkipAdkAgent() ? null : process.env.NEURAUDIT_ADK_AGENT_URL || null,
      adkAnalyzeConnected: analyzeHealth.connected,
    },
  }
}
