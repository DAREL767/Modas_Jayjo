from pathlib import Path

import pytest
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@pytest.fixture
def anyio_backend():
    return "asyncio"
