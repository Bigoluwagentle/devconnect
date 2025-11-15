"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";

interface SideBarProps {
  setChannel: (channelId: string) => void;
  activeChannel?: string;
}

interface Community {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
}

interface User {
  id: string;
  name: string;
  username: string;
  photoURL?: string;
  email: string;
}

interface DirectMessage {
  id: string;
  members: string[];
}

const DEFAULT_COMMUNITY_ID = "general";

const SideBar = ({ setChannel, activeChannel }: SideBarProps) => {
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [usersMap, setUsersMap] = useState<{ [id: string]: User }>({});
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [channelId: string]: number }>({});
  const [newCommunityName, setNewCommunityName] = useState("");
  const [inviteUsernames, setInviteUsernames] = useState<{ [key: string]: string }>({});
  const [dmUsernames, setDmUsernames] = useState("");

  // ---------------------------------------------------------
  // AUTH + INITIAL SETUP
  // ---------------------------------------------------------
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      setCurrentUser(user);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName || "Anonymous",
          username: user.email?.split("@")[0] || "user" + user.uid.slice(0, 5),
          email: user.email || "",
          photoURL: user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`,
          createdAt: Timestamp.now(),
        });
      }

      const generalRef = doc(db, "communities", DEFAULT_COMMUNITY_ID);
      const generalSnap = await getDoc(generalRef);

      if (generalSnap.exists()) {
        const members: string[] = generalSnap.data().members || [];
        if (!members.includes(user.uid)) {
          await updateDoc(generalRef, { members: arrayUnion(user.uid) });
        }
      } else {
        await setDoc(generalRef, {
          name: "General",
          createdBy: user.uid,
          members: [user.uid],
          createdAt: Timestamp.now(),
        });
      }

      if (!activeChannel) setChannel(DEFAULT_COMMUNITY_ID);
    });

    return () => unsubscribe();
  }, [activeChannel, setChannel]);

  // ---------------------------------------------------------
  // LOAD COMMUNITIES
  // ---------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "communities"),
      where("members", "array-contains", currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCommunities(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          createdBy: doc.data().createdBy,
          members: doc.data().members || [],
        }))
      );
    });
    return () => unsubscribe();
  }, [currentUser]);

  // ---------------------------------------------------------
  // LOAD USERS
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const map: { [id: string]: User } = {};
      snapshot.docs.forEach((doc) => (map[doc.id] = { id: doc.id, ...doc.data() } as User));
      setUsersMap(map);
    };
    fetchUsers();
  }, []);

  // ---------------------------------------------------------
  // LOAD DIRECT MESSAGES
  // ---------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;
    const dmQuery = query(
      collection(db, "directMessages"),
      where("members", "array-contains", currentUser.uid)
    );
    const unsubscribe = onSnapshot(dmQuery, (snapshot) => {
      setDirectMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          members: doc.data().members || [],
        }))
      );
    });
    return () => unsubscribe();
  }, [currentUser]);

  // ---------------------------------------------------------
  // UNREAD MESSAGES
  // ---------------------------------------------------------
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, "messages"), (snapshot) => {
      const newCounts: { [id: string]: number } = { ...unreadCounts };
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const channelId = data.channelId;
        if (data.senderId !== currentUser.uid && channelId !== activeChannel) {
          newCounts[channelId] = (newCounts[channelId] || 0) + 1;
        }
      });
      setUnreadCounts(newCounts);
    });
    return () => unsubscribe();
  }, [currentUser, activeChannel]);

  // ---------------------------------------------------------
  // CHANNEL CLICK
  // ---------------------------------------------------------
  const handleChannelClick = (channelId: string) => {
    setChannel(channelId);
    setUnreadCounts((prev) => ({ ...prev, [channelId]: 0 }));
    setMobileOpen(false);
  };

  // ---------------------------------------------------------
  // DIRECT MESSAGE START
  // ---------------------------------------------------------
  const handleStartDM = async () => {
    if (!currentUser || !dmUsernames.trim()) return;

    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("username", "==", dmUsernames));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      alert("No user found.");
      return;
    }

    const otherUserId = userSnapshot.docs[0].id;

    const dmRef = collection(db, "directMessages");
    const existingDMQuery = query(dmRef, where("members", "array-contains", currentUser.uid));
    const snapshot = await getDocs(existingDMQuery);

    let dmId: string | null = null;
    snapshot.docs.forEach((doc) => {
      const members: string[] = doc.data().members || [];
      if (members.includes(otherUserId)) dmId = doc.id;
    });

    if (!dmId) {
      const newDM = await addDoc(dmRef, { members: [currentUser.uid, otherUserId], createdAt: Timestamp.now() });
      dmId = newDM.id;
    }

    setChannel(dmId);
    setDmUsernames("");
    setMobileOpen(false);
  };

  return (
    <>
      <div className="md:hidden bg-[#1E2128] p-2 text-white">
        {/* <h1 className="text-xl font-semibold">DevConnect</h1> */}
        <Menu
          className="w-7 h-7"
          onClick={() => setMobileOpen(true)}
        />
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-[#1E2128] text-white z-40
          overflow-y-auto transition-all duration-300
          w-[80%] sm:w-[60%] md:w-[20%]
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Close button (mobile only) */}
        <div className="md:hidden flex justify-end p-4">
          <X className="w-7 h-7" onClick={() => setMobileOpen(false)} />
        </div>

        {/* SIDEBAR CONTENT */}
        <div className="px-4">  
          <h1 className="text-white font-bold text-xl mb-4">DevConnect</h1>

          {/* COMMUNITIES */}
          <p className="text-gray-400 mb-2">Your Communities</p>

          {communities.map((c) => (
            <div key={c.id} className="mb-4">
              <button
                onClick={() => handleChannelClick(c.id)}
                className="block w-full text-left px-2 py-2 text-white hover:bg-gray-700 rounded mb-1"
              >
                #{c.name} {unreadCounts[c.id] ? `(${unreadCounts[c.id]})` : ""}
              </button>

              <div className="ml-4 text-gray-300 mb-2">
                <p className="text-gray-400 text-sm mb-1">Members:</p>
                {c.members.map((uid) => (
                  <p key={uid} className="text-sm">
                    {usersMap[uid]?.username || "Unknown"}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {/* DIRECT MESSAGES */}
          <p className="text-gray-400 mt-6 mb-2">Direct Messages</p>

          {directMessages.map((dm) => {
            const otherUserId = dm.members.find((id) => id !== currentUser?.uid);
            const otherUser = otherUserId ? usersMap[otherUserId] : null;
            if (!otherUser) return null;

            return (
              <button
                key={dm.id}
                onClick={() => handleChannelClick(dm.id)}
                className="block w-full text-left px-2 py-2 text-white hover:bg-gray-700 rounded mb-1 flex items-center gap-2"
              >
                {otherUser.photoURL && (
                  <img
                    src={otherUser.photoURL}
                    alt="avatar"
                    className="w-6 h-6 rounded-full"
                  />
                )}
                @{otherUser.username} {unreadCounts[dm.id] ? `(${unreadCounts[dm.id]})` : ""}
              </button>
            );
          })}

          {/* START DM */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={dmUsernames}
              onChange={(e) => setDmUsernames(e.target.value)}
              placeholder="Username to DM"
              className="flex-1 bg-[#323743] text-white rounded px-2 py-1"
            />
            <button
              onClick={handleStartDM}
              className="bg-[#1E90FF] px-3 rounded text-white"
            >
              DM
            </button>
          </div>

          {/* NEW COMMUNITY */}
          <div className="flex gap-2 mt-5">
            <input
              type="text"
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              placeholder="New community"
              className="flex-1 bg-[#323743] text-white rounded px-2 py-1"
            />
            <button
              onClick={async () => {
                if (!currentUser || !newCommunityName.trim()) return;
                const communitiesRef = collection(db, "communities");
                const qSnapshot = await getDocs(query(communitiesRef, where("name", "==", newCommunityName)));
                if (!qSnapshot.empty) {
                  alert("Community already exists.");
                  return;
                }
                const docRef = await addDoc(communitiesRef, {
                  name: newCommunityName,
                  createdBy: currentUser.uid,
                  members: [currentUser.uid],
                  createdAt: Timestamp.now(),
                });
                setChannel(docRef.id);
                setNewCommunityName("");
                setMobileOpen(false);
              }}
              className="bg-[#1E90FF] px-3 rounded text-white"
            >
              +
            </button>
          </div>
        </div>

        {/* PROFILE + LOGOUT */}
        <div className="mt-6 px-4 mb-6">
          <button
            onClick={() => {
              router.push("/profile");
              setMobileOpen(false);
            }}
            className="block w-full px-4 py-2 text-white hover:bg-gray-700 rounded mb-1"
          >
            Profile
          </button>

          <button
            onClick={async () => {
              await auth.signOut();
              router.refresh();
            }}
            className="block w-full px-4 py-2 text-white hover:bg-gray-700 rounded"
          >
            Logout
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        ></div>
      )}
    </>
  );
};

export default SideBar;
