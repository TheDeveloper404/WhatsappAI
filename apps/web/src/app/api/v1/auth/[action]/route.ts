import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const REFRESH_COOKIE = 'refreshToken'
const AUTH_ACTIONS = new Set(['login', 'refresh', 'logout'])

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60,
}

function extractRefreshToken(setCookie: string | null) {
  const match = setCookie?.match(/(?:^|,\s*)refreshToken=([^;]+)/)
  return match?.[1]
}

export async function POST(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const action = params.action
  if (!AUTH_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Not found.' } },
      { status: 404 }
    )
  }

  const body = await request.text()
  const headers = new Headers({
    'Content-Type': request.headers.get('content-type') ?? 'application/json',
  })

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  if (refreshToken) {
    headers.set('Cookie', `${REFRESH_COOKIE}=${refreshToken}`)
  }

  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    headers.set('X-Forwarded-For', forwardedFor)
  }

  const upstream = await fetch(`${API_URL}/api/v1/auth/${action}`, {
    method: 'POST',
    headers,
    body: body || '{}',
    cache: 'no-store',
  })

  const responseBody = upstream.status === 204 ? null : await upstream.text()
  const response = new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  })

  if (action === 'logout') {
    response.cookies.set(REFRESH_COOKIE, '', {
      ...refreshCookieOptions,
      maxAge: 0,
    })
    return response
  }

  const newRefreshToken = extractRefreshToken(upstream.headers.get('set-cookie'))
  if (newRefreshToken) {
    response.cookies.set(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions)
  }

  return response
}
