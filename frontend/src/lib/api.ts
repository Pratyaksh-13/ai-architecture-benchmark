const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
    ...(opts.body ? { "Content-Type": "application/json" } : {}),
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: "include" });
  let data: any = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof msg === "string" ? msg : "Error", data);
  }
  return data as T;
}

export interface User { id: number; email: string; created_at: string }
export interface Project { id: number; requirement: string; status: "pending"|"generating"|"done"|"failed"; created_at: string; updated_at: string | null }
export interface Architecture { id: number; project_id: number; arch_type: "monolithic"|"microservices"|"event_driven"; explanation: string; mermaid_diagram: string; docker_compose: string | null; tradeoffs: {pros:string[]; cons:string[]} | null; llm_provider: string; created_at: string }
export interface Benchmark { id: number; architecture_id: number; project_id: number; latency_p50_ms: number; latency_p95_ms: number; latency_p99_ms: number; throughput_rps: number; error_rate_pct: number; cpu_usage_pct: number; memory_usage_mb: number; simulation_type: string; load_profile: "light"|"medium"|"heavy"; created_at: string }
export interface Recommendation { id: number; project_id: number; recommended_arch_type: "monolithic"|"microservices"|"event_driven"; reasoning: string; confidence_score: number; llm_provider: string; created_at: string }
export interface AnalysisResult { bottleneck_count: number; optimization_count: number; cost_estimate_count: number; status: string }
export interface BottleneckFinding { id: number; architecture_id: number; bottleneck_type: string; severity: "low"|"medium"|"high"|"critical"; evidence: string[]; recommendation: string | null; created_at: string }
export interface CapacityProjection { id: number; architecture_id: number; current_users: number; expected_users: number; growth_ratio: number | null; projected_latency_p95_ms: number | null; projected_throughput_rps: number | null; projected_cpu_pct: number | null; projected_memory_mb: number | null; scaling_recommendation: string | null; expected_bottlenecks: string[]; created_at: string }
export interface CostEstimate { id: number; architecture_id: number; provider: "aws"|"gcp"|"azure"; estimated_monthly_usd: number; instance_recommendation: string; cost_breakdown: { compute_usd: number; memory_usd: number; storage_usd: number; redis_usd: number; postgres_usd: number }; created_at: string }
export interface OptimizationRecommendation { id: number; recommendation_type: string; priority: "low"|"medium"|"high"; title: string; description: string; expected_improvement: string | null; created_at: string }
export interface EvolutionStep { id: number; from_arch_type: string | null; to_arch_type: string; trigger: string | null; notes: string | null; created_at: string }
export interface ResilienceScore { id: number; architecture_id: number; resilience_score: number; availability_pct: number; failure_type: string | null; recovered: boolean; recovery_time_ms: number | null; created_at: string }
export interface BenchmarkRun { id: number; architecture_id: number; project_id: number; latency_p50_ms: number; latency_p95_ms: number; latency_p99_ms: number; throughput_rps: number; error_rate_pct: number; cpu_usage_pct: number; memory_usage_mb: number; simulation_type: string; load_profile: "light"|"medium"|"heavy"; created_at: string }

export const auth = {
  me: () => api<User>("/auth/me"),
  login: (email: string, password: string) =>
    api<{ message: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (email: string, password: string) =>
    api<{ message: string }>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => api("/auth/logout", { method: "POST" }),
  verify: (token: string) => api<{ message: string }>(`/auth/verify?token=${encodeURIComponent(token)}`),
  resend: (email: string) => api<{ message: string }>("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
};

export const projects = {
  list: () => api<{ total: number; projects: Project[] }>("/projects/").then(r => r.projects),
  create: (requirement: string) => api<Project>("/projects/", { method: "POST", body: JSON.stringify({ requirement }) }),
  get: (id: number) => api<Project>(`/projects/${id}`),
  delete: (id: number) => api(`/projects/${id}`, { method: "DELETE" }),
  generate: (id: number, provider?: string | null) =>
    api<{ project_id: number; architectures: Architecture[] }>(`/projects/${id}/generate`, { method: "POST", body: JSON.stringify({ provider: provider ?? null }) }).then(r => r.architectures),
  architectures: (id: number) =>
    api<{ project_id: number; architectures: Architecture[] }>(`/projects/${id}/architectures`).then(r => r.architectures),
  benchmark: (id: number, load_profile: "light"|"medium"|"heavy") =>
    api<Benchmark[]>(`/projects/${id}/benchmark`, { method: "POST", body: JSON.stringify({ load_profile }) }),
  benchmarks: (id: number) =>
    api<{ project_id: number; benchmarks: Benchmark[] }>(`/projects/${id}/benchmarks`).then(r => r.benchmarks),
  benchmarkReal: (id: number, load_profile: "light"|"medium"|"heavy") =>
    api<{ project_id: number; benchmarks: Benchmark[] }>(`/projects/${id}/benchmark/real`, { method: "POST", body: JSON.stringify({ load_profile }) }),
  benchmarkRealAsync: (id: number, load_profile: "light"|"medium"|"heavy") =>
    api<{ job_id: string; status: string; message: string }>(`/projects/${id}/benchmark/real/async`, { method: "POST", body: JSON.stringify({ load_profile }) }),
  cancelJob: (job_id: string) =>
    api<{ job_id: string; status: string }>(`/projects/jobs/${job_id}`, { method: "DELETE" }),
  jobStatus: (job_id: string) =>
    api<{ job_id: string; status: string; result?: any; error?: string; meta?: any }>(`/projects/jobs/${job_id}`),
  recommend: (id: number, provider?: string | null) =>
    api<Recommendation>(`/projects/${id}/recommend`, { method: "POST", body: JSON.stringify({ provider: provider ?? null }) }),
  recommendation: (id: number) => api<Recommendation>(`/projects/${id}/recommendation`),
  scores: (id: number) => api<any>(`/projects/${id}/scores`),
  analyze: (id: number) =>
    api<AnalysisResult>(`/projects/${id}/analyze`, { method: "POST" }),
  bottlenecks: (id: number) =>
    api<{ findings: BottleneckFinding[] }>(`/projects/${id}/bottlenecks`).then(r => r.findings),
  capacityGet: (id: number) =>
    api<{ projections: CapacityProjection[] }>(`/projects/${id}/capacity`).then(r => r.projections),
  capacityPost: (id: number, current_users: number, expected_users: number) =>
    api<{ projections: CapacityProjection[] }>(`/projects/${id}/capacity`, {
      method: "POST", body: JSON.stringify({ current_users, expected_users }),
    }).then(r => r.projections),
  costs: (id: number) =>
    api<{ estimates: CostEstimate[] }>(`/projects/${id}/costs`).then(r => r.estimates),
  optimizations: (id: number) =>
    api<{ recommendations: OptimizationRecommendation[] }>(`/projects/${id}/optimizations`).then(r => r.recommendations),
  evolution: (id: number) =>
    api<{ timeline: EvolutionStep[] }>(`/projects/${id}/evolution`).then(r => r.timeline),
  resilience: (id: number) =>
    api<{ project_id: number; results: ResilienceScore[] }>(`/projects/${id}/resilience`).then(r => r.results ?? []),
  history: (id: number) =>
    api<{ project_id: number; runs: BenchmarkRun[] }>(`/projects/${id}/history`).then(r => r.runs ?? []),
  reportMarkdown: (id: number) =>
    api<string>(`/projects/${id}/report/markdown`),
  reportPdf: (id: number) =>
    fetch(`${BASE}/projects/${id}/report/pdf`, { credentials: "include", headers: { "ngrok-skip-browser-warning": "true" } }),
};
