import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import type { StoryMapLayout } from '../types';

export interface UserProfile {
  timelineGranularity?: 'day' | 'week' | 'quarter' | 'year';
  timelineShowIssues?: boolean;
  kanbanMilestoneNumber?: number | null;
  timelineMilestoneOrder?: number[];
  address?: string;
  phone?: string;
  signupDate?: string;
  dateOfBirth?: string;
  age?: number;
  notes?: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

function repoKey(owner: string, repo: string) {
  return `${owner}__${repo}`;
}

export async function loadLayout(
  owner: string,
  repo: string,
): Promise<StoryMapLayout | null> {
  const ref = doc(db, 'storyMaps', repoKey(owner, repo));
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as StoryMapLayout) : null;
}

export async function saveLayout(
  owner: string,
  repo: string,
  layout: StoryMapLayout,
): Promise<void> {
  const ref = doc(db, 'storyMaps', repoKey(owner, repo));
  await setDoc(ref, layout);
}

export async function loadUserProfile(): Promise<UserProfile | null> {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const ref = doc(db, 'userProfiles', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ref = doc(db, 'userProfiles', uid);
  await setDoc(ref, profile, { merge: true });
}
