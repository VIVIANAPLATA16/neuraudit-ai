export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { runComplianceChecks } from "@/lib/compliance-check"

export async function GET() {
  const status = await runComplianceChecks()
  return NextResponse.json(status)
}
