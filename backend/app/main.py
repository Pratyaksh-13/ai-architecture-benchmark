from fastapi import FastAPI

app = FastAPI(
    title="AI Architecture Benchmarking API",
    version="1.0.0"
)

@app.get("/")
def root():
    return {
        "message": "AI Architecture Benchmarking API is running!"
    }