import {
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  getAdditionalUserInfo,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';
import { saveUserKey } from './userKeys';

export interface SignInResult {
  user: User;
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
  // Store the GitHub OAuth token server-side; the browser never holds it.
  await saveUserKey('github', githubToken);
  const githubLogin =
    (getAdditionalUserInfo(result)?.username as string | undefined) ?? '';
  return { user: result.user, githubLogin };
}

export async function signOutFromFirebase(): Promise<void> {
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
