import type { DataApi } from './api';
import { createFirebaseApi, type FirebaseSettings } from './firebase';
import { createMemoryApi } from './memory';

declare const __FIREBASE_CONFIG__: FirebaseSettings | null;

export const api: DataApi = __FIREBASE_CONFIG__ ? createFirebaseApi(__FIREBASE_CONFIG__) : createMemoryApi();
