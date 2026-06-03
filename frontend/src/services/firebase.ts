/**
 * Firebase SDK — configuração do cliente (frontend).
 *
 * Usado para:
 * - Login com Google (GoogleAuthProvider)
 * - Login com número de telefone (PhoneAuthProvider)
 *
 * As credenciais aqui são PÚBLICAS (web config) — não confundir
 * com a Service Account do backend que é PRIVADA.
 *
 * Como obter:
 * Firebase Console → Definições do projecto → As tuas apps
 * → Adicionar app Web → copiar o firebaseConfig
 */
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  Auth,
  ConfirmationResult,
} from "firebase/auth";

// ── Configuração (preenche com os valores do Firebase Console) ────────
// Firebase Console → Definições → As tuas apps → Web → firebaseConfig
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

// Singleton — evita inicializar múltiplas vezes em hot reload
let app: FirebaseApp;
let auth: Auth;

function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  return app;
}

function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

// ── Login com Google ──────────────────────────────────────────────────
export async function signInWithGoogle(): Promise<string> {
  const firebaseAuth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");

  const result = await signInWithPopup(firebaseAuth, provider);
  // Obtém o ID token para enviar ao backend
  const idToken = await result.user.getIdToken();
  return idToken;
}

// ── Login com Telefone — Passo 1: enviar SMS ──────────────────────────
export async function sendPhoneOTP(
  phoneNumber: string,
  recaptchaContainerId: string
): Promise<ConfirmationResult> {
  const firebaseAuth = getFirebaseAuth();

  const recaptchaVerifier = new RecaptchaVerifier(
    firebaseAuth,
    recaptchaContainerId,
    { size: "invisible" }
  );

  const confirmationResult = await signInWithPhoneNumber(
    firebaseAuth,
    phoneNumber,
    recaptchaVerifier
  );

  return confirmationResult;
}

// ── Login com Telefone — Passo 2: verificar código SMS ───────────────
export async function verifyPhoneOTP(
  confirmationResult: ConfirmationResult,
  code: string
): Promise<string> {
  const result = await confirmationResult.confirm(code);
  const idToken = await result.user.getIdToken();
  return idToken;
}

// ── Logout do Firebase (limpa sessão local) ───────────────────────────
export async function firebaseSignOut(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  await firebaseAuth.signOut();
}
