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


def test_input_output_models():
    from worker.workflows.neon_sql import SqlInput, SqlOutput

    inp = SqlInput(statements=["SELECT 1", "CREATE TABLE t (id int)"])
    assert inp.statements[0] == "SELECT 1"
    out = SqlOutput(results=[{"rows": [[1]]}])
    assert out.results[0]["rows"][0][0] == 1
    with pytest.raises(pydantic.ValidationError):
        SqlInput()


def test_activity_defined():
    from worker.workflows.neon_sql import run_neon_sql

    assert run_neon_sql.__name__ == "run-neon-sql"


def test_connector_slot():
    from worker.workflows.neon_sql import neon

    assert neon.connector_name == "neon_a06a"
