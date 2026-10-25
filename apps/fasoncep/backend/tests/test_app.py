from auth_helpers import login_client
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from app.main import app


def test_create_update_workshop():
    with TemporaryDirectory() as temp:
        old = os.environ.get("FASONCEP_DATA_DIR")
        os.environ["FASONCEP_DATA_DIR"] = temp
        try:
            with TestClient(app) as client:
                login_client(client)
                assert client.get("/api/health").json() == {"status": "ok", "mode": "local"}
                assert client.get("/api/workshops").json() == []
                payload = {"name": "  ABC Tekstil  ", "work_types": ["Dikim"], "employee_band": "6-10"}
                response = client.post("/api/workshops", json=payload)
                assert response.status_code == 201, response.text
                assert response.json()["name"] == "ABC Tekstil"
                assert client.get("/api/workshops").json()[0]["name"] == "ABC Tekstil"
                update = {"name": "Yeni Tekstil", "work_types": ["Dikim", "Kesim"], "phone": "0555 000 00 00"}
                assert client.put(f"/api/workshops/{response.json()['id']}", json=update).status_code == 200
                result = client.get("/api/workshops").json()[0]
                assert result["work_types"] == ["Dikim", "Kesim"]
                assert result["phone"] == "0555 000 00 00"
                assert Path(temp, "fasoncep.db").exists()
        finally:
            if old is None:
                os.environ.pop("FASONCEP_DATA_DIR", None)
            else:
                os.environ["FASONCEP_DATA_DIR"] = old


def test_invalid_workshop():
    with TemporaryDirectory() as temp:
        old = os.environ.get("FASONCEP_DATA_DIR")
        os.environ["FASONCEP_DATA_DIR"] = temp
        try:
            with TestClient(app) as client:
                login_client(client)
                assert client.post("/api/workshops", json={"name": " ", "work_types": ["Dikim"]}).status_code == 422
                assert client.post("/api/workshops", json={"name": "Atölye", "work_types": []}).status_code == 422
                assert client.post("/api/workshops", json={"name": "Atölye", "work_types": ["Dikim", "Dikim"]}).status_code == 422
                assert client.get("/api/workshops").json() == []
        finally:
            if old is None:
                os.environ.pop("FASONCEP_DATA_DIR", None)
            else:
                os.environ["FASONCEP_DATA_DIR"] = old


def test_contact_validation():
    import pytest
    from pydantic import ValidationError
    from app.schemas import WorkshopInput

    base = {"name": "Atölye", "work_types": ["Dikim"]}
    for field, value in [
        ("phone", "123"), ("phone", "0555abc1234567"),
        ("phone", "1234567890123456"), ("email", "bozuk@"),
        ("email", "a@firma"), ("email", "a b@firma.com"),
        ("employee_band", "0"), ("address", "x" * 351),
        ("description", "x" * 501), ("name", "x" * 121),
    ]:
        with pytest.raises(ValidationError):
            WorkshopInput(**{**base, field: value})
    result = WorkshopInput(**base, phone=" +90 (555) 123-45-67 ", email=" bilgi@firma.com ", address="   ")
    assert result.phone == "+90 (555) 123-45-67"
    assert result.email == "bilgi@firma.com"
    assert result.address is None
    assert WorkshopInput(**base, phone=" ", email=" ").phone is None
