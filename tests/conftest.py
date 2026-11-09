from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from atlas.config import Settings
from atlas.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(tmp_path / "test.sqlite3", "https://provider.example/v1", "", "test-model")


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as client:
        yield client
