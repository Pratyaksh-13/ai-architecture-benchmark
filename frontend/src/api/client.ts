import axios from 'axios'
import type { Project, ProjectListResponse, GenerateResponse } from '../types'
import type { ProjectBenchmarksResponse } from '../types'
import type { Recommendation } from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,   
})

export const createProject = async (requirement: string): Promise<Project> => {
  const { data } = await api.post('/projects/', { requirement })
  return data
}

export const getProjects = async (): Promise<ProjectListResponse> => {
  const { data } = await api.get('/projects/')
  return data
}

export const getProject = async (id: number): Promise<Project> => {
  const { data } = await api.get(`/projects/${id}`)
  return data
}

export const generateArchitectures = async (
  id: number,
  provider?: string
): Promise<GenerateResponse> => {
  const { data } = await api.post(`/projects/${id}/generate`, { provider })
  return data
}

export const getArchitectures = async (id: number): Promise<GenerateResponse> => {
  const { data } = await api.get(`/projects/${id}/architectures`)
  return data
}

export const deleteProject = async (id: number): Promise<void> => {
  await api.delete(`/projects/${id}`)
}
export const runBenchmark = async (id: number, loadProfile: string = 'medium'): Promise<ProjectBenchmarksResponse> => {
  const { data } = await api.post(`/projects/${id}/benchmark`, {load_profile: loadProfile })
  return data
}

export const getBenchmarks = async (id: number): Promise<ProjectBenchmarksResponse> => {
  const { data } = await api.get(`/projects/${id}/benchmarks`)
  return data
}

export const generateRecommendation = async (id: number, provider?: string): Promise<Recommendation> => {
  const { data } = await api.post(`/projects/${id}/recommend`, { provider })
  return data
}

export const getRecommendation = async (id: number): Promise<Recommendation | null> => {
  try {
    const { data } = await api.get(`/projects/${id}/recommendation`)
    return data
  } catch {
    return null  // 404 means no recommendation yet — not an error state
  }
}
export const signup = async (email: string, password: string) => {
  const { data } = await api.post('/auth/signup', { email, password })
  return data
}

export const login = async (email: string, password: string) => {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export const logout = async () => {
  await api.post('/auth/logout')
}

export const getCurrentUser = async () => {
  const { data } = await api.get('/auth/me')
  return data
}