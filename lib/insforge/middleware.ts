import { type NextRequest } from 'next/server'
import { createServerClient } from './client'

const SESSION_COOKIE_NAME = "facturado_session_id"

export async function updateSession(request: NextRequest) {
  const userId = request.cookies.get(SESSION_COOKIE_NAME)?.value

  if (!userId) {
    return { session: null, user: null }
  }

  const insforge = createServerClient()

  try {
    const { data: users, error } = await insforge.database
      .from('users')
      .select('id, name, username, role')
      .eq('id', userId)
      .limit(1)

    if (error || !users || users.length === 0) {
      return { session: null, user: null }
    }

    return {
      session: { user_id: userId },
      user: users[0]
    }
  } catch (error) {
    console.error('Middleware error:', error)
    return { session: null, user: null }
  }
}