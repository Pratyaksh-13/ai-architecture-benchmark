import axios from 'axios'
import type { Project, ProjectListResponse, GenerateResponse } from '../types'
import type { ProjectBenchmarksResponse } from '../types'
const api = axios.create({ baseURL: '/api/v1' })

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
export const runBenchmark = async (id: number): Promise<ProjectBenchmarksResponse> => {
  const { data } = await api.post(`/projects/${id}/benchmark`)
  return data
}

export const getBenchmarks = async (id: number): Promise<ProjectBenchmarksResponse> => {
  const { data } = await api.get(`/projects/${id}/benchmarks`)
  return data
}