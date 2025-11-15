"use client";

import { auth } from "./firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";

export const signupUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await sendEmailVerification(userCredential.user);

    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};
