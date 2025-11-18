// app/api/news/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const category = params.get("category") || "technology";
    const pageSize = params.get("pageSize") || "8";
    const country = params.get("country") || "us";

    const API_KEY = process.env.NEWS_API_KEY; // <-- set in .env.local

    if (!API_KEY) {
      return NextResponse.json({ error: "Missing NEWS_API_KEY on server" }, { status: 500 });
    }

    // Using NewsAPI.org top-headlines endpoint
    const q = `https://newsapi.org/v2/top-headlines?category=${encodeURIComponent(
      category
    )}&pageSize=${encodeURIComponent(pageSize)}&country=${encodeURIComponent(country)}&apiKey=${API_KEY}`;

    const res = await fetch(q);
    if (!res.ok) {
      const txt = await res.text();
      console.error("NewsAPI failed:", res.status, txt);
      return NextResponse.json({ error: "News API error", status: res.status }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("api/news error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
