import { useState, useCallback, useEffect } from 'react'
import type { Project } from '@/types'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [base, setBase] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
      setBase(data.base || '')
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const validatePath = useCallback(async (path: string): Promise<{ valid: boolean; path: string; isDir: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/workspace/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      return await res.json()
    } catch {
      return { valid: false, path, isDir: false, error: 'Failed to validate' }
    }
  }, [])

  return { projects, base, loading, refresh, validatePath }
}
