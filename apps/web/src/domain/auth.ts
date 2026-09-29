export type AuthenticatedProfile = {
  id: string;
  fullName: string;
  preferredName: string | null;
};

// Expand this allowlist only when a real protected destination is implemented.
export function safeDestination(input: unknown): '/app' {
  if (input === '/app') return input;
  return '/app';
}

export function loginError(status?: number): string {
  if (status === 400 || status === 401 || status === 422) return 'Email atau kata sandi tidak sesuai.';
  if (status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  return 'Layanan masuk belum dapat dihubungi. Silakan coba lagi.';
}
