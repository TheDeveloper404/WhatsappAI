'use client'
import { useLayoutEffect } from 'react'

export function ScrollRestoreTop() {
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [])
  return null
}
