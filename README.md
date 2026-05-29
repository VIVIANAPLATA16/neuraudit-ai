# 🧠 NeurAudit AI — Anti-Corruption Agent for Colombian Public Contracts

**Google Cloud Rapid Agent Hackathon 2026 — Elastic Track**

NeurAudit AI is an intelligent agent that analyzes public contracts from Colombia's SECOP II system using AI to detect corruption risks, lack of competition, cost overruns, and anomalous patterns.

## What it does
- Connects to SECOP II public API (datos.gov.co) to fetch real contracts
- Analyzes contracts with Gemini AI via Google Cloud Agent Builder
- Generates a corruption risk score (0-100) with detailed alerts
- Builds a contractor network map to detect concentration and collusion
- Integrates Elastic for semantic search across 9+ million public contracts

## Tech Stack
- Google Cloud Agent Builder
- Gemini AI
- Elastic MCP
- Next.js 16
- SECOP II API

## Getting Started
1. Clone the repo
2. Run: npm install
3. Copy .env.example to .env.local and add your keys
4. Run: npm run dev

## Environment Variables needed in .env.local
- ANTHROPIC_API_KEY
- GOOGLE_CLOUD_PROJECT
- ELASTIC_API_KEY

## Data Sources
All data is 100% public from the Colombian government:
- SECOP II: https://www.datos.gov.co/resource/jbjy-vk9h.json
- PACO: https://portal.paco.gov.co

## License
MIT - see LICENSE file
