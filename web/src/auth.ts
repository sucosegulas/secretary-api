// Simple auth helper — armazena a sessão no localStorage
// Em produção real, isto seria uma autenticação via backend com JWT

const CREDENTIALS = [
  { user: 'trailercar123', password: 'motorhome', role: 'admin' },
];

export function login(user: string, password: string): boolean {
  const match = CREDENTIALS.find(
    (c) => c.user === user && c.password === password
  );
  if (match) {
    sessionStorage.setItem('auth_user', JSON.stringify({ user: match.user, role: match.role }));
    return true;
  }
  return false;
}

export function logout(): void {
  sessionStorage.removeItem('auth_user');
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem('auth_user');
}

export function getAuthUser(): { user: string; role: string } | null {
  const raw = sessionStorage.getItem('auth_user');
  return raw ? JSON.parse(raw) : null;
}
