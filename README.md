<div align="center">

# ⚡ ArchBench

### AI Architecture Decision Intelligence Engine

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_19-TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![AWS](https://img.shields.io/badge/AWS-EC2-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com)



**Stop guessing your architecture. Start benchmarking it.**

ArchBench takes your natural language requirements, generates three production-grade architecture proposals, deploys real benchmark applications, runs live load tests with k6, and produces a data-driven Architecture Decision Report — all in one platform.

[**Live Demo**](#) · [**Documentation**](#) · [**Report a Bug**](issues) · [**Request a Feature**](issues)

---
<p align="center">
  <img src="dashboard.png" alt="ArchBench Dashboard" width="100%">
</p>

</div>

---

## 🤔 Why ArchBench?

Every engineering team faces the same question: **Monolith, Microservices, or Event-Driven?**

The answer depends on your specific load profile, team size, budget, and scalability needs — but most tools give you opinions, not data. ArchBench gives you **real numbers from real benchmarks** on your specific requirements.

| Traditional Approach | ArchBench Approach |
|---|---|
| Architecture discussions based on gut feeling | AI-generated proposals grounded in your requirements |
| Theoretical comparisons from blog posts | Real k6 load tests on deployed benchmark apps |
| Manual cost estimates | Automated cloud cost projections |
| Decision made before any data exists | Decision backed by latency, throughput, and resilience data |

---

## ✨ Key Features

- 🤖 **AI Architecture Generation** — LLM-powered generation of Monolithic, Microservices, and Event-Driven proposals from natural language input
- 📊 **Real Benchmarking** — Not simulations. Actual benchmark applications are deployed and tested with k6
- 🔄 **Async Benchmark Execution** — Celery-powered task queue for non-blocking, background benchmark runs
- 📈 **Comprehensive Metrics** — Latency (p50/p95/p99), throughput (RPS), error rate, CPU, and memory usage
- 🛡️ **Resilience Testing** — Fault injection, chaos testing, and recovery time measurement
- 🔍 **Bottleneck Detection** — Automated identification of performance constraints across architectures
- 💰 **Cloud Cost Estimation** — AWS cost projections based on measured resource consumption
- 📐 **Capacity Planning** — Scalability curves and future traffic projections
- 🏋️ **Architecture Fitness Engine** — Scores each architecture against your requirement vectors
- 🧠 **Hybrid Recommendation Engine** — Combines benchmark performance + requirement fitness for a final recommendation
- 📄 **Decision Reports** — Production-ready Architecture Decision Reports in Markdown and PDF
- 🔐 **JWT Authentication** — Secure user auth with email verification

<p align="center">
  <img src="login.png" width="100%">
</p>


- 🐳 **Dockerized Deployment** — One-command setup for local and production environments
- ☁️ **AWS EC2 Ready** — Pre-configured for cloud deployment

---

## 🏗️ System Architecture

<p align="center">
  <img src="mermaid.png" width="100%">
</p>

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (React 19 + TypeScript)"]
        UI[Dashboard / Project Manager]
        BENCH_UI[Benchmark Results Viewer]
        REPORT_UI[Report Generator]
    end

    subgraph API["⚙️ FastAPI Backend"]
        AUTH[Auth Service\nJWT + Email Verification]
        PROJ[Project Service]
        AI[AI Generation Service\nLLM Orchestration]
        BENCH[Benchmark Orchestrator]
        REC[Recommendation Engine]
        REPORT[Report Service]
    end

    subgraph Queue["📬 Async Layer"]
        CELERY[Celery Workers]
        REDIS_Q[Redis Broker]
    end

    subgraph Benchmarks["🚀 Benchmark Applications"]
        MONO[Monolith App\nFlask / FastAPI]
        MICRO[Microservices\nDocker Compose]
        EVENT[Event-Driven\nKafka + Workers]
    end

    subgraph LoadTest["🔨 Load Testing"]
        K6[k6 Engine]
        METRICS[Metrics Collector]
    end

    subgraph Storage["🗄️ Data Layer"]
        PG[(PostgreSQL\nProjects / Results)]
        REDIS_C[(Redis\nCache / Sessions)]
    end

    subgraph Infra["☁️ Infrastructure"]
        EC2[AWS EC2]
        DOCKER[Docker Compose]
    end

    UI --> AUTH
    UI --> PROJ
    UI --> AI
    BENCH_UI --> BENCH
    REPORT_UI --> REPORT

    AI --> CELERY
    BENCH --> CELERY
    CELERY --> REDIS_Q
    CELERY --> MONO
    CELERY --> MICRO
    CELERY --> EVENT
    CELERY --> K6

    K6 --> METRICS
    METRICS --> REC
    REC --> REPORT

    API --> PG
    API --> REDIS_C
    BENCHMARKS --> DOCKER
    DOCKER --> EC2
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS | UI, state management, type safety |
| **Backend** | FastAPI, Python 3.11+ | REST API, async request handling |
| **Task Queue** | Celery + Redis | Async benchmark execution |
| **Database** | PostgreSQL 16 | Projects, results, users |
| **Cache** | Redis 7 | Session cache, Celery broker |
| **Load Testing** | k6 | Real HTTP load generation |
| **AI/LLM** | Claude, OpenAI, OpenRouter | Architecture generation |
| **Containerization** | Docker, Docker Compose | Benchmark apps + deployment |
| **Infra** | AWS EC2, Nginx | Production hosting |
| **Auth** | JWT + Email Verification | Secure authentication |
| **Diagrams** | Mermaid.js | Architecture visualization |

---

## 🔄 How It Works

### 1. AI Architecture Generation Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant API as FastAPI
    participant LLM as LLM Provider
    participant DB as PostgreSQL

    U->>API: POST /projects/{id}/generate<br/>{"requirements": "e-commerce platform, 10k DAU..."}
    API->>LLM: Generate Monolith proposal + Mermaid diagram
    API->>LLM: Generate Microservices proposal + Docker Compose
    API->>LLM: Generate Event-Driven proposal + diagram
    LLM-->>API: 3 architecture specs (JSON)
    API->>DB: Store proposals
    API-->>U: Proposals ready (with diagrams)
```

### 2. Real Benchmark Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant API as FastAPI
    participant CEL as Celery
    participant APP as Benchmark App
    participant K6 as k6 Engine
    participant REC as Recommendation Engine

    U->>API: POST /benchmarks/run
    API->>CEL: Enqueue benchmark task (async)
    API-->>U: 202 Accepted + task_id

    CEL->>APP: docker-compose up (Monolith)
    CEL->>K6: Run load test (VUs=50, duration=2m)
    K6-->>CEL: Latency / Throughput / Error metrics
    CEL->>APP: docker-compose up (Microservices)
    CEL->>K6: Run load test
    K6-->>CEL: Metrics
    CEL->>APP: docker-compose up (Event-Driven)
    CEL->>K6: Run load test
    K6-->>CEL: Metrics

    CEL->>REC: Score architectures (perf + fitness)
    REC-->>CEL: Ranked recommendation
    CEL->>API: Store results
    U->>API: GET /benchmarks/{task_id}/results
    API-->>U: Full benchmark report
```

### 📊 Live Benchmark Dashboard

<p align="center">
  <img src="benchmark.png" width="100%">
</p>


### 3. Recommendation Engine

The hybrid recommendation engine combines two signal sources with configurable weights:

```
Final Score = (α × Benchmark Performance Score) + (β × Requirement Fitness Score)
```

**Benchmark Performance Score** is derived from:
- Normalized p99 latency (lower is better)
- Requests per second throughput (higher is better)
- Error rate under load (lower is better)
- CPU and memory efficiency

**Requirement Fitness Score** is derived from an architecture fitness engine that parses your requirements and scores each architecture against vectors including:
- Team size and operational complexity
- Expected traffic patterns
- Consistency vs. availability tradeoffs
- Deployment complexity tolerance
- Budget constraints

The engine then applies bottleneck detection, resilience scores from fault injection tests, and cloud cost projections to produce a ranked final recommendation with supporting rationale.



## 📈 Analytics Dashboard

Visualize latency, throughput, CPU usage, memory consumption, and recommendation scores.

<p align="center">
  <img src="analytics.png" width="100%">
</p>
---

## 📁 Folder Structure

```
archbench/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth.py          # JWT auth, email verification
│   │   │       ├── projects.py      # Project CRUD
│   │   │       ├── generation.py    # AI architecture generation
│   │   │       ├── benchmarks.py    # Benchmark orchestration
│   │   │       ├── reports.py       # Report generation
│   │   │       └── recommendations.py
│   │   ├── core/
│   │   │   ├── config.py            # Settings (pydantic-settings)
│   │   │   ├── security.py          # JWT logic
│   │   │   └── celery_app.py        # Celery configuration
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── strategy.py      # Strategy pattern for LLM providers
│   │   │   │   ├── claude.py
│   │   │   │   ├── openai.py
│   │   │   │   └── openrouter.py
│   │   │   ├── benchmark/
│   │   │   │   ├── orchestrator.py  # Docker Compose management
│   │   │   │   ├── k6_runner.py     # k6 load test execution
│   │   │   │   └── metrics.py       # Metrics collection & parsing
│   │   │   ├── recommendation/
│   │   │   │   ├── engine.py        # Hybrid recommendation logic
│   │   │   │   ├── fitness.py       # Requirement fitness scoring
│   │   │   │   └── bottleneck.py    # Bottleneck detection
│   │   │   └── report/
│   │   │       ├── generator.py     # Markdown/PDF report builder
│   │   │       └── templates/
│   │   └── tasks/
│   │       └── benchmark_tasks.py   # Celery async tasks
│   ├── benchmark_apps/
│   │   ├── monolith/                # Benchmark monolith app
│   │   ├── microservices/           # Benchmark microservices setup
│   │   └── event_driven/            # Benchmark event-driven app
│   ├── k6_scripts/
│   │   └── load_test.js             # k6 load test scripts
│   ├── alembic/                     # DB migrations
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   ├── BenchmarkResults/
│   │   │   ├── ArchitectureDiagram/
│   │   │   └── ReportViewer/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/                     # Axios API client + JWT interceptors
│   │   └── types/
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml               # Full stack orchestration
├── docker-compose.prod.yml          # Production overrides
└── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)
- k6 installed ([install guide](https://k6.io/docs/get-started/installation/))

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
POSTGRES_DB=archbench
POSTGRES_USER=archbench_user
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://archbench_user:your_secure_password@db:5432/archbench

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
SECRET_KEY=your_super_secret_key_min_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (for verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your_app_password

# LLM Providers (add whichever you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
DEFAULT_LLM_PROVIDER=claude   # claude | openai | openrouter

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🐳 Running with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/archbench.git
cd archbench

# Set up environment
cp .env.example .env
# Edit .env with your values

# Start all services
docker compose up --build

# Run database migrations
docker compose exec backend alembic upgrade head
```

The platform will be available at:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs

---

## 💻 Running Locally (Development)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start FastAPI
uvicorn app.main:app --reload --port 8000

# In a separate terminal, start Celery worker
celery -A app.core.celery_app worker --loglevel=info
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## ☁️ Production Deployment (AWS EC2)

```bash
# On your EC2 instance (Ubuntu 22.04 recommended)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx

# Clone and configure
git clone https://github.com/yourusername/archbench.git
cd archbench
cp .env.example .env
# Edit .env for production (use strong secrets, real SMTP, etc.)

# Start with production compose file
docker compose -f docker-compose.prod.yml up -d

# Set up Nginx reverse proxy
sudo cp nginx/nginx.conf /etc/nginx/sites-available/archbench
sudo ln -s /etc/nginx/sites-available/archbench /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> 💡 **Tip:** Use an Elastic IP on your EC2 instance and point your domain to it for a stable URL.

---

## 📡 API Overview

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register with email verification |
| `POST` | `/api/v1/auth/login` | Login, receive JWT |
| `GET` | `/api/v1/projects` | List user projects |
| `POST` | `/api/v1/projects` | Create project with requirements |
| `POST` | `/api/v1/projects/{id}/generate` | Trigger AI architecture generation |
| `GET` | `/api/v1/projects/{id}/architectures` | Fetch generated architectures + diagrams |
| `POST` | `/api/v1/benchmarks/run` | Start async benchmark run |
| `GET` | `/api/v1/benchmarks/{task_id}/status` | Poll benchmark task status |
| `GET` | `/api/v1/benchmarks/{task_id}/results` | Fetch full benchmark results |
| `GET` | `/api/v1/recommendations/{project_id}` | Get hybrid recommendation |
| `POST` | `/api/v1/reports/{project_id}/generate` | Generate Decision Report (MD/PDF) |

Full interactive docs available at `/docs` (Swagger UI) and `/redoc`.

---

## 📊 Example Output

### Benchmark Results (sample)

```
Architecture        | p50 Latency | p99 Latency | RPS     | Error Rate | CPU Avg
--------------------|-------------|-------------|---------|------------|--------
Monolith            | 12ms        | 45ms        | 1,240   | 0.1%       | 38%
Microservices       | 28ms        | 120ms       | 890     | 0.8%       | 52%
Event-Driven        | 8ms         | 35ms        | 1,580   | 0.2%       | 41%
```

### Recommendation Engine Output (sample)

```json
{
  "recommended": "event_driven",
  "confidence": 0.87,
  "scores": {
    "monolith":      { "benchmark": 0.74, "fitness": 0.61, "final": 0.68 },
    "microservices": { "benchmark": 0.58, "fitness": 0.72, "final": 0.65 },
    "event_driven":  { "benchmark": 0.89, "fitness": 0.85, "final": 0.87 }
  },
  "rationale": "Event-Driven architecture achieves the lowest p99 latency and highest throughput under the specified load profile. Given the async-heavy workload pattern in your requirements, the decoupled producer-consumer model aligns well with your scalability goals.",
  "bottlenecks_detected": ["microservices: inter-service network overhead at >500 RPS"],
  "estimated_monthly_cost_usd": {
    "monolith": 142,
    "microservices": 387,
    "event_driven": 218
  }
}
```

---

## 🔮 Future Improvements

- [ ] **Kubernetes support** — Generate Helm charts alongside Docker Compose configs
- [ ] **More LLM providers** — Gemini, Mistral, local Ollama
- [ ] **Custom benchmark scripts** — Let users define their own k6 scenarios
- [ ] **Historical trend analysis** — Track how architectures evolve over requirement changes
- [ ] **Team collaboration** — Multi-user projects with shared reports
- [ ] **CI/CD integration** — GitHub Actions webhook to trigger re-benchmarking on requirement changes
- [ ] **Serverless architecture type** — Add Lambda/Cloud Functions as a 4th architecture option
- [ ] **Real-time benchmark streaming** — WebSocket updates during live benchmark runs

---

## 🤝 Contributing

Contributions are welcome!

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
# Make your changes
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
# Open a Pull Request
```

Please follow conventional commits and ensure all tests pass (`pytest` for backend, `npm test` for frontend).

---

<div align="center">

Built by [Pratyaksh Tyagi](https://github.com/Pratyaksh-13) · IIT Jodhpur

⭐ If ArchBench helped you make a better architecture decision, consider giving it a star!

</div>
