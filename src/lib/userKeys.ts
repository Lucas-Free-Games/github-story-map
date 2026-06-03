import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app, 'us-central1');

export type AiProvider = 'anthropic' | 'gemini';

export interface UserKeyStatus {
  anthropic: boolean;
  gemini: boolean;
}

export async function saveUserKey(provider: AiProvider, apiKey: string): Promise<void> {
  const call = httpsCallable(functions, 'saveUserKey');
  await call({ provider, apiKey });
}

export async function deleteUserKey(provider: AiProvider): Promise<void> {
  const call = httpsCallable(functions, 'deleteUserKey');
  await call({ provider });
}

export async function getUserKeyStatus(): Promise<UserKeyStatus> {
  const call = httpsCallable<unknown, UserKeyStatus>(functions, 'getUserKeyStatus');
  const result = await call();
  return result.data;
}
