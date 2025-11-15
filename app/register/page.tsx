"use client";

import { useState } from "react";
import Link from "next/link";
import { auth, db } from "../lib/firebase";
import { supabase } from "../lib/supabase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function Signup() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {

    e.preventDefault();
    setError(null);

    if (!name || !username || !email || !password || !confirm) {
      setError("Please fill all fields.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      
      // 1️⃣ Check if username is unique
      const usersRef = collection(db, "users");
      const usernameQuery = query(usersRef, where("username", "==", username));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!username.trim() || !email.trim()) {
        setError("Username and email cannot be empty.");
        setLoading(false);
        return;
      }
      console.log("📌 CHECKING USERNAME...");

      if (!usernameSnapshot.empty) {
        setError("Username already taken. Choose another one.");
        setLoading(false);
        return;
      }
      // 2️⃣ Create user with email & password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;



      // 3️⃣ Wait a bit to ensure Firestore sees the signed-in user
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("USER UID:", user.uid);

      // 4️⃣ Set displayName
      await updateProfile(user, { displayName: username });

      // 5️⃣ Send email verification
      await sendEmailVerification(user);

      // 6️⃣ Create Firestore user document
      await setDoc(doc(db, "users", user.uid), {
        name,
        username,
        email,
        createdAt: new Date(),
      });

      // 7️⃣ Redirect to verification page
      window.location.href = "/verify-email";
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        window.location.href = "/verify-email";
      } else {
        setError(err.message || "Failed to create account.");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleOAuth = async (provider: "google" | "github") => {
      try {
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/chat`,
          },
        });
      } catch (e: any) {
        alert("Failed")
      }
    };

  return (
    <div className="flex items-center justify-center pt-10 bg-black w-full min-h-screen px-4">
      <section className="flex flex-col items-center justify-center bg-[#1E2128] w-full max-w-md min-h-[95vh] border border-[#323743] rounded-2xl p-8 shadow-lg">
        <h1 className="text-[#1E90FF] font-bold text-3xl mb-8">DevConnect</h1>

        <nav className="w-full flex items-center justify-between mb-8">
          <Link href="/login" className="w-[48%]">
            <button className="border border-gray-600 w-full h-11 rounded-md text-white font-semibold">
              Login
            </button>
          </Link>

          <Link href="/register" className="w-[48%]">
            <button className="bg-[#1E90FF] w-full h-11 rounded-md text-white font-semibold">
              Sign Up
            </button>
          </Link>
        </nav>

        <form className="w-full flex flex-col gap-4" onSubmit={handleCreateAccount}>
          <div className="flex flex-col w-full">
            <label className="text-white font-medium mb-1">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              placeholder="John Doe"
              className="bg-[#323743] h-12 rounded-lg px-3 text-white outline-none border border-transparent focus:border-[#1E90FF]"
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="text-white font-medium mb-1">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              placeholder="john123"
              className="bg-[#323743] h-12 rounded-lg px-3 text-white outline-none border border-transparent focus:border-[#1E90FF]"
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="text-white font-medium mb-1">Email Address</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="example@gmail.com"
              className="bg-[#323743] h-12 rounded-lg px-3 text-white outline-none border border-transparent focus:border-[#1E90FF]"
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="text-white font-medium mb-1">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="bg-[#323743] h-12 rounded-lg px-3 text-white outline-none border border-transparent focus:border-[#1E90FF]"
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="text-white font-medium mb-1">Confirm Password</label>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              placeholder="Confirm"
              className="bg-[#323743] h-12 rounded-lg px-3 text-white outline-none border border-transparent focus:border-[#1E90FF]"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-[#1E90FF] h-12 font-bold text-white rounded-md w-full mt-2 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Account & Send Verification"}
          </button>
        </form>

        <p className="my-4 text-white text-sm">OR</p>

        <button
          onClick={() => handleOAuth("github")}
          className="w-full bg-black border border-gray-600 text-white h-12 rounded-lg mb-3 text-sm"
        >
          Continue with GitHub
        </button>

        <button
          onClick={() => handleOAuth("google")}
          className="w-full bg-black border border-gray-600 text-white h-12 rounded-lg text-sm"
        >
          Continue with Google
        </button>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          After clicking the verification link in your email, come back to log in.
        </p>
      </section>
    </div>
  );
}
