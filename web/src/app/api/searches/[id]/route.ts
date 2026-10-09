import { NextResponse } from "next/server";
import { loadSearch } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const search = await loadSearch(params.id);
    if (!search) {
      return NextResponse.json({ error: "Search not found." }, { status: 404 });
    }
    return NextResponse.json(search);
  } catch (err: unknown) {
    console.error("Fetch search error:", err);
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }
}
