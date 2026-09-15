import { NextResponse } from "next/server";
import { fulfillmentCsv } from "@/app/actions/orders";

export async function GET() {
  const csv = await fulfillmentCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fulfillment-batch.csv"',
    },
  });
}
