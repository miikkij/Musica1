from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Composer API")

from composer.server.routes.clips import router as clips_router  # noqa: E402
from composer.server.routes.bpm import router as bpm_router  # noqa: E402
from composer.server.routes.project import router as project_router  # noqa: E402
app.include_router(clips_router)
app.include_router(bpm_router)
app.include_router(project_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:7860", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
