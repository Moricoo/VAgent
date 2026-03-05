import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/app');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || '用户名或密码错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Back link */}
      <div className="p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>
      </div>

      {/* Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
              <Video className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900">欢迎回来</h1>
            <p className="text-sm text-gray-400 mt-1.5">登录以访问您的工作空间</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="请输入用户名"
                  autoComplete="username"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-sm text-white transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    登录中...
                  </>
                ) : '登 录'}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center mb-3">快速填入演示账号</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fillDemo('admin', 'admin123')}
                  className="py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-200 hover:bg-gray-100 transition-all font-medium"
                >
                  admin / admin123
                </button>
                <button
                  onClick={() => fillDemo('demo', 'demo123')}
                  className="py-2.5 px-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-200 hover:bg-gray-100 transition-all font-medium"
                >
                  demo / demo123
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-5">
            没有账号？
            <span className="text-violet-600 ml-1 cursor-pointer hover:text-violet-800 transition-colors font-medium">联系销售团队</span>
          </p>
        </div>
      </div>
    </div>
  );
}
