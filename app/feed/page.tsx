"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import {
  Heart,
  MessageCircle,
  Share2,
  Send,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";

type Article = {
  title: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  source?: { name?: string } | string;
  publishedAt?: string;
  content?: string;
};

type Post = {
  id: string;
  title?: string;
  content?: string;
  url?: string;
  image?: string;
  source?: string;
  createdAt?: any;
  authorId?: string;
  authorName?: string;
  likes?: string[];
};

type RedditPost = {
  id: string;
  title: string;
  content?: string;
  url?: string;
  image?: string;
  author?: string;
  subreddit?: string;
  createdAt?: number;
};

export default function CommunityFeedPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [redditPosts, setRedditPosts] = useState<RedditPost[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingReddit, setLoadingReddit] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [creating, setCreating] = useState(false);

  const [commentsOpenFor, setCommentsOpenFor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postComments, setPostComments] = useState<Record<string, Array<any>>>({});

  const commentInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Post[] = [];
      snap.forEach((d) => {
        const data: any = d.data();
        arr.push({
          id: d.id,
          title: data.title,
          content: data.content,
          url: data.url,
          image: data.image,
          source: data.source,
          createdAt: data.createdAt,
          authorId: data.authorId,
          authorName: data.authorName,
          likes: data.likes || [],
        });
      });
      setPosts(arr);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadNews = async () => {
      try {
        setLoadingNews(true);
        const res = await fetch("/api/news?category=technology&pageSize=8");
        const json = await res.json();
        setArticles(json.articles || []);
      } catch (err) {
        console.error("Failed to load news:", err);
      } finally {
        setLoadingNews(false);
      }
    };
    loadNews();
  }, []);

  useEffect(() => {
    const loadReddit = async () => {
      try {
        setLoadingReddit(true);
        const res = await fetch("https://www.reddit.com/r/technology/top.json?limit=6");
        const json = await res.json();
        const mapped: RedditPost[] = json.data.children.map((item: any) => {
          const data = item.data;
          return {
            id: data.id,
            title: data.title,
            content: data.selftext || "",
            url: `https://reddit.com${data.permalink}`,
            image: data.thumbnail && data.thumbnail.startsWith("http") ? data.thumbnail : undefined,
            author: data.author,
            subreddit: data.subreddit,
            createdAt: data.created_utc,
          };
        });
        setRedditPosts(mapped);
      } catch (err) {
        console.error("Failed to fetch Reddit posts:", err);
      } finally {
        setLoadingReddit(false);
      }
    };
    loadReddit();
  }, []);

  const requireAuth = (action: () => void) => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    action();
  };

  const createPost = (fromArticle?: Article) => {
    requireAuth(async () => {
      setCreating(true);
      try {
        const payload: any = {
          title: fromArticle?.title || newTitle || "Untitled",
          content: fromArticle?.description || newText || fromArticle?.content || "",
          url: fromArticle?.url || null,
          image: fromArticle?.urlToImage || null,
          source:
            typeof fromArticle?.source === "string"
              ? fromArticle.source
              : (fromArticle?.source?.name as string) || null,
          authorId: currentUser.uid,
          authorName: currentUser.displayName || currentUser.email?.split("@")[0] || "Anonymous",
          likes: [],
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, "feedPosts"), payload);
        setNewTitle("");
        setNewText("");
      } catch (err) {
        console.error("createPost failed:", err);
        alert("Failed to create post");
      } finally {
        setCreating(false);
      }
    });
  };

  const toggleLike = (postId: string, likedAlready: boolean) => {
    requireAuth(async () => {
      const ref = doc(db, "feedPosts", postId);
      try {
        if (likedAlready) await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
        else await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
      } catch (err) {
        console.error("toggleLike error:", err);
      }
    });
  };

  const openComments = async (postId: string) => {
    if (!currentUser) return;
    setCommentsOpenFor(postId);
    if (!postComments[postId]) {
      const snap = await getDocs(collection(db, `feedPosts/${postId}/comments`));
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setPostComments((prev) => ({ ...prev, [postId]: arr }));
    }
    setTimeout(() => commentInputs.current[postId]?.focus(), 120);
  };

  const addComment = (postId: string) => {
    requireAuth(async () => {
      if (!commentText.trim()) return;
      const col = collection(db, `feedPosts/${postId}/comments`);
      await addDoc(col, {
        userId: currentUser.uid,
        username: currentUser.displayName || currentUser.email?.split("@")[0] || "Anonymous",
        text: commentText.trim(),
        createdAt: serverTimestamp(),
      });
      setCommentText("");
      const snap = await getDocs(collection(db, `feedPosts/${postId}/comments`));
      const arr: any[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setPostComments((prev) => ({ ...prev, [postId]: arr }));
    });
  };

  return (
    <div className="min-h-screen bg-[#0E0F12] text-white">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 py-6">
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-6 space-y-4">
            <div className="bg-[#1E2128] p-4 rounded-2xl border border-[#323743]">
              <h2 className="font-bold text-xl">DevConnect</h2>
              <p className="text-sm text-gray-400 mt-2">
                Share updates, discuss tech news, and connect with other developers.
              </p>
              <Link href="/login">
                <button className="border-1 border-white border-solid mt-4 px-8 py-1 cursor-pointer rounded-sm">Login Now!</button>
              </Link>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-6 space-y-4">
          {currentUser && (
            <div className="bg-[#1E2128] p-4 rounded-2xl border border-[#323743]">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-full bg-[#323743] flex items-center justify-center text-white">
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="me" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm">{(currentUser.displayName || "U").charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    placeholder="Title (optional)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-transparent text-white placeholder-gray-400 outline-none pb-1 border-b border-transparent focus:border-b focus:border-[#323743] mb-2"
                  />
                  <textarea
                    placeholder="What's happening?"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="w-full bg-[#121418] px-3 py-2 rounded text-white outline-none resize-none h-24"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3 text-gray-300">
                      <button title="Attach image" className="p-2 rounded hover:bg-[#2a2e34]">
                        <ImageIcon className="w-5 h-5" />
                      </button>
                      <button title="Attach link" className="p-2 rounded hover:bg-[#2a2e34]">
                        <LinkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setNewText("");
                          setNewTitle("");
                        }}
                        className="px-3 py-1 rounded border border-gray-600"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => createPost()}
                        disabled={creating}
                        className="bg-[#1E90FF] px-4 py-2 rounded font-semibold disabled:opacity-60"
                      >
                        {creating ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {posts.map((p) => {
              const liked = currentUser ? p.likes?.includes(currentUser.uid) : false;
              return (
                <article key={p.id} className="bg-[#1E2128] p-4 rounded-2xl border border-[#323743] hover:shadow-lg transition-shadow">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#323743] flex items-center justify-center text-white">
                      {p.authorName ? <span className="font-semibold">{p.authorName.charAt(0)}</span> : "U"}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-semibold">{p.title || "Untitled"}</h4>
                      <div className="text-xs text-gray-400">
                        {p.source ? `${p.source} · ` : ""} {p.authorName ? `by ${p.authorName}` : ""}
                      </div>
                      {p.image && <img src={p.image} alt="" className="w-full max-h-64 object-cover rounded mt-3" />}
                      {p.content && <p className="text-gray-300 mt-3">{p.content}</p>}
                      {p.url && (
                        <a href={p.url} target="_blank" rel="noreferrer" className="text-sm text-[#1E90FF] hover:underline mt-2 inline-block">
                          Read original
                        </a>
                      )}

                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => (currentUser ? toggleLike(p.id!, !!liked) : router.push("/login"))}
                          className={`flex items-center gap-2 px-3 py-1 rounded ${liked ? "bg-[#1E90FF] text-black" : "bg-[#323743]"}`}
                        >
                          <Heart className="w-4 h-4" />
                          <span className="text-sm">{liked ? "Liked" : "Like"}</span>
                          <span className="text-xs text-gray-200"> {p.likes?.length ? `(${p.likes.length})` : ""}</span>
                        </button>
                        <button
                          onClick={() => (currentUser ? openComments(p.id!) : router.push("/login"))}
                          className="flex items-center gap-2 px-3 py-1 rounded bg-[#323743]"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm">Comments</span>
                          <span className="text-xs text-gray-200">
                            {(postComments[p.id!]?.length) ? `(${postComments[p.id!].length})` : ""}
                          </span>
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1 rounded bg-[#323743]">
                          <Share2 className="w-4 h-4" />
                          <span className="text-sm">Share</span>
                        </button>
                      </div>

                      {commentsOpenFor === p.id && currentUser && (
                        <div className="mt-4 border-t border-[#2a2e34] pt-4">
                          <div className="space-y-3 max-h-56 overflow-y-auto pr-2">
                            {(postComments[p.id!] || []).map((c: any) => (
                              <div key={c.id} className="bg-[#121418] p-3 rounded">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="text-xs text-gray-300 font-semibold">{c.username}</div>
                                    <div className="text-sm text-gray-200 mt-1">{c.text}</div>
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleString() : ""}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2 mt-3">
                            <input
                              ref={(el) => {
                                if (p.id) commentInputs.current[p.id] = el;
                              }}
                              placeholder="Write a comment..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              className="flex-1 bg-[#121418] px-3 py-2 rounded text-white outline-none"
                            />
                            <button onClick={() => addComment(p.id!)} className="bg-[#1E90FF] px-4 py-2 rounded">
                              <Send className="w-4 h-4" />
                            </button>
                            <button onClick={() => setCommentsOpenFor(null)} className="px-3 py-2 rounded border border-gray-600">
                              Close
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </main>

        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-6 space-y-4">
            <div className="bg-[#1E2128] p-4 rounded-2xl border border-[#323743]">
              <h3 className="font-semibold text-lg">Tech News</h3>
              <p className="text-xs text-gray-400 mt-1">Latest updates from the tech world</p>
            </div>

            <div className="bg-[#1E2128] p-4 rounded-2xl border border-[#323743] space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {loadingNews && <p className="text-gray-400">Loading news…</p>}
              {!loadingNews && articles.length === 0 && <p className="text-gray-400">Login to see the latest News.</p>}

              {articles.map((a, i) => (
                <article key={i} className="flex gap-3 items-start bg-[#0F1113] p-3 rounded">
                  <img src={a.urlToImage || "/placeholder-article.png"} className="w-20 h-14 object-cover rounded" alt="" />
                  <div className="flex-1">
                    <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-sm hover:underline">{a.title}</a>
                    <div className="text-xs text-gray-400 mt-1">
                      {(typeof a.source === "string" ? a.source : a.source?.name) || ""} · {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : ""}
                    </div>
                  </div>
                </article>
              ))}

              {loadingReddit && <p className="text-gray-400 mt-2">Loading Reddit posts…</p>}
              {!loadingReddit && redditPosts.length > 0 && redditPosts.map((r) => (
                <article key={r.id} className="flex gap-3 items-start bg-[#0F1113] p-3 rounded">
                  {r.image && <img src={r.image} alt="" className="w-20 h-14 object-cover rounded" />}
                  <div className="flex-1">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-sm hover:underline">{r.title}</a>
                    <div className="text-xs text-gray-400 mt-1">
                      {r.subreddit ? `r/${r.subreddit}` : ""} · by {r.author || "unknown"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
