from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import games, news, agents

app = FastAPI(title="Sustainet Inc. API")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應該設置具體的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 註冊路由
app.include_router(games.router, prefix="/api/game", tags=["game"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])

@app.get("/")
async def root():
    return {"message": "Welcome to Sustainet Inc. API"} 