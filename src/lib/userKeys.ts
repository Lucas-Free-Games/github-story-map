import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

export type Provider = 'anthropic' | 'gemini' | 'github';
/** @deprecated kept for backward-compatible imports. */
export type AiProvider = Provider;

export interface UserKeyStatus {
  anthropic: boolean;
  gemini: boolean;
  github: boolean;
}

export async function saveUserKey(provider: Provider, apiKey: string): Promise<void> {
  const call = httpsCallable(functions, 'saveUserKey');
  await call({ provider, apiKey });
}

export async function deleteUserKey(provider: Provider): Promise<void> {
  const call = httpsCallable(functions, 'deleteUserKey');
  await call({ provider });
}

export async function getUserKeyStatus(): Promise<UserKeyStatus> {
  const call = httpsCallable<unknown, UserKeyStatus>(functions, 'getUserKeyStatus');
  const result = await call();
  return result.data;
}
