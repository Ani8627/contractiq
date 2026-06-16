'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const signIn = async () => {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signOut = async () => {
    await supabaseBrowser.auth.signOut()
    location.href = '/'
  }

  if (email) {
    return (
      <div className="flex items-center gap-2">
        <span>{email}</span>
        <button
          onClick={signOut}
          className="rounded-md border px-3 py-2"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={signIn}
      className="rounded-md border px-4 py-2"
    >
      Sign in with Google
    </button>
  )
}