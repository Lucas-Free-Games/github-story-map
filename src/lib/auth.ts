import {
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getAdditionalUserInfo,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

const TOKEN_KEY = 'gh_token';

export function getCachedGithubToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setCachedGithubToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCachedGithubToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SignInResult {
  user: User;
  githubToken: string;
  githubLogin: string;
}

export async function signInWithGithub(): Promise<SignInResult> {
  const provider = new GithubAuthProvider();
  provider.addScope('repo');
  provider.addScope('project');
  const result = await signInWithPopup(auth, provider);
  const credential = GithubAuthProvider.credentialFromResult(result);
  const githubToken = credential?.accessToken;
  if (!githubToken) {
    throw new Error('Sign-in succeeded but no GitHub access token was returned.');
  }
  const githubLogin =
    (getAdditionalUserInfo(result)?.username as string | undefined) ?? '';
  setCachedGithubToken(githubToken);
  return { user: result.user, githubToken, githubLogin };
}

export async function signOutFromFirebase(): Promise<void> {
  clearCachedGithubToken();
  await signOut(auth);
}

export function observeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return user.getIdToken();
}
