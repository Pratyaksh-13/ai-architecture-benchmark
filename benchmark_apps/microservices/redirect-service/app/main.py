import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse

app = FastAPI(title="URL Shortener — Redirect Service")

SHORTENER_SERVICE_URL = os.getenv("SHORTENER_SERVICE_URL", "http://shortener-service:8000")


@app.get("/health")
def health():
    return {"status": "ok", "service": "redirect-service"}


@app.get("/{code}")
async def redirect(code: str):
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.get(f"{SHORTENER_SERVICE_URL}/resolve/{code}")
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Shortener service unavailable")

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Short URL not found")
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Shortener service error")

    data = response.json()
    return RedirectResponse(url=data["original_url"], status_code=307)
