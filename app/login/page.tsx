'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data.error ?? 'ログインに失敗しました'
        setError(msg)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div
        className="rounded-2xl border shadow-lg p-8"
        style={{
          backgroundColor: '#fff',
          borderColor: '#B8A483',
        }}
      >
        <div className="text-center mb-6">
          <div className="text-xs font-bold tracking-widest text-[#97876A] mb-1">M&amp;A ROYAL ADVISORY</div>
          <h1 className="text-2xl font-bold" style={{ color: '#222222' }}>
            MAS
          </h1>
          <p className="text-sm text-[#808080] mt-1">M&amp;A LOYAL Article System</p>
        </div>
        <p className="text-sm text-[#555555] text-center mb-6">
          メールアドレスとパスワードを入力してください
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#333333] mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-lg border border-[#D5C9B8] bg-white text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#97876A]"
              placeholder="example@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#333333] mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-lg border border-[#D5C9B8] bg-white text-[#222222] focus:outline-none focus:ring-2 focus:ring-[#97876A]"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-white transition-colors disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#97876A' }}
          >
            {loading ? '確認中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
