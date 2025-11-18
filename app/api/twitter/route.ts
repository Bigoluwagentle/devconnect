import { NextResponse } from "next/server";

export async function GET() {
  try {
    const query = "technology"; // change this to any hashtag/keyword
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
      query
    )}&max_results=10&tweet.fields=author_id,created_at,public_metrics,text`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("Twitter API failed:", res.status, txt);
      return NextResponse.json({ error: "Twitter API error" }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err: any) {
    console.error("Twitter API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
