from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


engine = None
AsyncSessionLocal = None


def init_db(url: str) -> None:
    global engine, AsyncSessionLocal
    engine = create_async_engine(url, echo=False)
    AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def create_tables() -> None:
    """Create all tables using the engine initialized by init_db."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
