export interface Project {
  id: number
  requirement: string
  status: 'pending' | 'generating' | 'done' | 'failed'
  created_at: string
  updated_at: string | null
}

export interface Architecture {
  id: number
  project_id: number
  arch_type: 'monolithic' | 'microservices' | 'event_driven'
  explanation: string
  mermaid_diagram: string
  docker_compose: string | null
  tradeoffs: { pros: string[]; cons: string[] } | null
  llm_provider: string
  created_at: string
}

export interface ProjectListResponse {
  total: number
  projects: Project[]
}

export interface GenerateResponse {
  project_id: number
  architectures: Architecture[]
}
export interface Benchmark {
  id: number
  architecture_id: number
  project_id: number
  latency_p50_ms: number
  latency_p95_ms: number
  latency_p99_ms: number
  throughput_rps: number
  error_rate_pct: number
  cpu_usage_pct: number
  memory_usage_mb: number
  simulation_type: string
  created_at: string
}

export interface ProjectBenchmarksResponse {
  project_id: number
  benchmarks: Benchmark[]
}
export interface Recommendation {
  id: number
  project_id: number
  recommended_arch_type: string
  reasoning: string
  confidence_score: number
  llm_provider: string
  created_at: string
}