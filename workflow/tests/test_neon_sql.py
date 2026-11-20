"""Validation statique du workflow Neon (sans Temporal ni réseau)."""

import pydantic
import pytest

import mistralai.workflows as workflows


@pytest.fixture(scope="module")
def registered():
    import worker.workflows  # noqa: F401

    return {
        "classes": workflows.discover_all_workflows_in_package(
            "worker.workflows", skip_modules={"worker.workflows.__init__"}
        )
    }


def test_workflow_discovered(registered):
    names = [c.__name__ for c in registered["classes"]]
    assert names == ["SurcoufNeonSqlWorkflow"]


def test_workflow_name_matches_registration(registered):
    cls = registered["classes"][0]
    definition = workflows.get_workflow_definition(cls)
    assert definition.name == "surcouf-neon-sql"


def test_call_models():
    from worker.workflows.neon_sql import NeonCall, NeonCallsInput, NeonCallsOutput

    inp = NeonCallsInput(
        calls=[
            {"tool": "list_projects", "arguments": {"search": "Rennes"}},
            {"tool": "run_sql_transaction", "arguments": {"sql_statements": ["SELECT 1"], "project_id": "p1"}},
        ]
    )
    assert inp.calls[0].arguments == {"search": "Rennes"}
    out = NeonCallsOutput(results=[{"data": []}])
    assert out.results == [{"data": []}]
    with pytest.raises(pydantic.ValidationError):
        NeonCallsInput()
    with pytest.raises(pydantic.ValidationError):
        NeonCall(tool="")


def test_activity_defined():
    from worker.workflows.neon_sql import run_neon_sql

    assert run_neon_sql.__name__ == "run-neon-sql"


def test_connector_slot():
    from worker.workflows.neon_sql import neon

    assert neon.connector_name == "neon_a06a"


def test_allowlist():
    from worker.workflows.neon_sql import ALLOWED_TOOLS

    assert "list_projects" in ALLOWED_TOOLS
    assert "run_sql" in ALLOWED_TOOLS
    assert "run_sql_transaction" in ALLOWED_TOOLS
    assert "get_connection_string" in ALLOWED_TOOLS
    assert "delete_project" not in ALLOWED_TOOLS
