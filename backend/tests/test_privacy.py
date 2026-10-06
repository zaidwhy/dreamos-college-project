from app import privacy
from app.config import settings


def test_default_configuration_is_local_only():
    report = privacy.audit()

    assert report["local_only"] is True
    assert report["data_can_leave_machine"] is False
    assert all(e["is_loopback"] for e in report["endpoints"])


def test_a_remote_model_endpoint_is_reported_as_leaving_the_machine(monkeypatch):
    monkeypatch.setattr(settings, "ollama_base_url", "http://models.example.com:11434")

    report = privacy.audit()

    assert report["local_only"] is False
    assert report["data_can_leave_machine"] is True
    assert report["endpoints"][0]["host"] == "models.example.com"


def test_loopback_forms_are_all_recognised(monkeypatch):
    for url in ("http://127.0.0.1:11434", "http://localhost:11434", "http://[::1]:11434"):
        monkeypatch.setattr(settings, "ollama_base_url", url)
        assert privacy.audit()["local_only"] is True, url


def test_report_admits_what_it_does_not_verify():
    assert "netstat" in privacy.audit()["not_verified_by_this_report"]
