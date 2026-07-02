import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { login } from '../auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Simula um pequeno delay para parecer profissional
    await new Promise(r => setTimeout(r, 600));

    const success = login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError('Usuário ou senha incorretos. Tente novamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #4f46e5, transparent)' }}></div>
      <div className="absolute bottom-[-15%] right-[-10%] w-96 h-96 rounded-full blur-3xl opacity-30" style={{ background: 'radial-gradient(circle, #2563eb, transparent)' }}></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10" style={{ background: 'radial-gradient(circle, #818cf8, transparent)' }}></div>

      <div className="max-w-md w-full relative z-10" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(16px)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '24px', padding: '40px' }}>
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 shadow-lg" style={{ background: 'linear-gradient(135deg, #4f46e5, #2563eb)', boxShadow: '0 0 40px rgba(79,70,229,0.4)' }}>
            <Bot size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Secretaria Virtual</h1>
          <p className="text-slate-400 text-sm">Trailercar Motorhomes</p>
          <div className="mt-3 inline-block text-xs px-3 py-1 rounded-full font-medium" style={{ background: 'rgba(79,70,229,0.15)', color: '#818cf8', border: '1px solid rgba(79,70,229,0.3)' }}>
            Painel de Atendimento
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 mb-5 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Usuário</label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuário"
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-white placeholder-slate-600 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                required
                className="w-full pl-11 pr-12 py-3.5 rounded-xl text-white placeholder-slate-600 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.15)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl text-white font-semibold text-base transition-all active:scale-95 mt-2 disabled:opacity-70"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #2563eb)', boxShadow: '0 4px 24px rgba(79,70,229,0.4)' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Autenticando...
              </span>
            ) : 'Entrar no Painel'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-8">
          Trailercar Motorhomes © {new Date().getFullYear()} — Painel Interno
        </p>
      </div>
    </div>
  );
}
