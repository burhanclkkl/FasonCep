import pytest

@pytest.fixture(autouse=True)
def existing_application_tests(monkeypatch):
    # Existing CRUD/auth tests exercise the separately enabled application mode.
    monkeypatch.setenv('FASONCEP_SITE_MODE', 'application')
