import { NextResponse } from "next/server";
import { mockDb } from "@/lib/mock-db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(mockDb.flavors, {
    headers: { "Cache-Control": "no-store" }
  });
}
