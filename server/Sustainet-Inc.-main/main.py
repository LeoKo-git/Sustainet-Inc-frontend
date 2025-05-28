# src/main.py
import uvicorn

from fastapi import FastAPI, Depends
from src.api.middleware.cors import setup_cors
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy import text

from src.api.routes import games_router, agents_router, news_router
from src.api.middleware.error_handler import setup_exception_handlers
from src.config import settings
from src.utils.logger import logger
from src.infrastructure.database.session import get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 啟動事件
    logger.info("API 服務啟動中", extra={
        "environment": settings.app_env,
        "port": settings.app_port
    })
    yield
    # 關閉事件
    logger.info("API 服務關閉中")

# 創建 FastAPI 應用
app = FastAPI(
    title="Sustainet-Inc API",
    description="Sustainet Inc. 的 API 服務",
    version="0.1.0",
    lifespan=lifespan
)

# 設定 CORS
setup_cors(app)

# 設定全局異常處理
setup_exception_handlers(app)

# 加載 API 路由
app.include_router(games_router, prefix="/api/games")
app.include_router(agents_router, prefix="/api/agents")
app.include_router(news_router, prefix="/api/news")

# 健康檢查端點
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # 測試資料庫連線
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"資料庫連線檢查失敗: {str(e)}")
        db_status = "disconnected"
    
    return {
        "status": "ok",
        "environment": settings.app_env,
        "version": app.version,
        "database": {
            "status": db_status
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.app_port, reload=True)