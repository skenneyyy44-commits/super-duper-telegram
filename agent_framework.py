"""
Agent framework with pluggable LLMs, basic tooling, and lightweight orchestration.

Highlights
----------
- Orchestrator: plans and routes work while logging execution metadata.
- Tools: registry for typed callables (web/file/code/etc.).
- Agents: research, code, communications.
- Memory: simple vector-ish store + KV store stub.
- Safety: basic hooks.

Swap DummyLLMClient for a real LLM (OpenAI, Gemini, Claude, etc.) by
injecting a different ``LLMClient`` implementation.
"""

from __future__ import annotations

import abc
import importlib.util
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Protocol


# =========================
# Utility helpers
# =========================


def now_iso() -> str:
    """Return the current UTC timestamp in ISO-8601 format."""

    return datetime.utcnow().isoformat() + "Z"


def json_dump(obj: Any) -> str:
    """Pretty-print JSON with UTF-8 support."""

    return json.dumps(obj, ensure_ascii=False, indent=2)


def strip_json_fences(text: str) -> str:
    """Remove markdown-style code fences to improve JSON parsing resilience."""

    lines: Iterable[str] = (
        line for line in text.splitlines() if not line.strip().startswith("```")
    )
    return "\n".join(lines)


def parse_json(text: str) -> Any:
    """Parse JSON from raw model output, handling lightly fenced payloads."""

    cleaned = strip_json_fences(text.strip())
    return json.loads(cleaned)


# =========================
# Core task / plan structs
# =========================


class StepStatus:
    PENDING = "pending"
    BLOCKED = "blocked"
    DONE = "done"
    ERROR = "error"


class TaskStatus:
    PENDING = "pending"
    COMPLETED = "completed"
    ERROR = "error"


@dataclass
class Step:
    description: str
    agent_name: str
    inputs: Dict[str, Any] = field(default_factory=dict)
    result: Optional[Any] = None
    status: str = StepStatus.PENDING
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None

    def mark_started(self) -> None:
        self.started_at = now_iso()

    def mark_finished(self, duration: float) -> None:
        self.finished_at = now_iso()
        self.duration_seconds = duration


@dataclass
class Task:
    user_id: str
    objective: str
    context: Dict[str, Any] = field(default_factory=dict)
    plan: List[Step] = field(default_factory=list)
    status: str = TaskStatus.PENDING
    logs: List[str] = field(default_factory=list)

    def append_log(self, message: str) -> None:
        self.logs.append(f"[{now_iso()}] {message}")


# =========================
# Tooling layer
# =========================


class ToolRegistry:
    def __init__(self) -> None:
        self.tools: Dict[str, Callable[..., Any]] = {}

    def register(self, name: str, fn: Callable[..., Any]) -> None:
        if name in self.tools:
            raise ValueError(f"Tool '{name}' is already registered")
        self.tools[name] = fn

    def call(self, name: str, **kwargs) -> Any:
        if name not in self.tools:
            raise ValueError(f"Unknown tool: {name}")
        return self.tools[name](**kwargs)

    def available(self) -> List[str]:
        return sorted(self.tools.keys())


def web_search_tool(query: str, max_results: int = 3) -> List[Dict[str, Any]]:
    print(f"[web_search_tool] Searching for: {query}")
    return [{"title": f"Fake result for {query}", "url": "https://example.com"} for _ in range(max_results)]


def read_file_tool(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def run_code_tool(language: str, code: str) -> Dict[str, Any]:
    print(f"[run_code_tool] {language} code length={len(code)}")
    return {"status": "not_implemented", "output": "", "error": None}


# =========================
# LLM clients
# =========================


class LLMClient(Protocol):
    """Minimal interface for pluggable chat-style LLM clients."""

    def chat(self, system: str, user: str) -> str:
        ...


class DummyLLMClient:
    """Minimal stand-in. Replace with a real LLM client."""

    def chat(self, system: str, user: str) -> str:
        if "break it down into a small number of concrete steps" in system:
            return json_dump(
                {
                    "steps": [
                        {
                            "description": "Do initial research on the objective",
                            "agent_name": "research",
                        },
                        {
                            "description": "Produce a final written summary",
                            "agent_name": "comms",
                        },
                    ]
                }
            )
        if "You are a synthesis engine" in system:
            return "SYNTHESIZED REPORT:\n" + user[:400]
        if "senior analyst" in system:
            return "FINAL ANSWER:\n" + user[:400]
        return f"[DUMMY LLM RESPONSE]\n{user[:400]}"


class OpenAIChatClient:
    """Simple OpenAI Chat Completions client.

    Requires ``openai`` to be installed and ``OPENAI_API_KEY`` to be set.
    """

    def __init__(self, model: str = "gpt-4o-mini", api_key: Optional[str] = None) -> None:
        if importlib.util.find_spec("openai") is None:
            raise RuntimeError("The 'openai' package is required for OpenAIChatClient")

        from openai import OpenAI  # type: ignore

        self.model = model
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")
        self.client = OpenAI(api_key=self.api_key)

    def chat(self, system: str, user: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        message = response.choices[0].message.content
        return message or ""


# =========================
# Memory layer
# =========================


class SimpleVectorStore:
    """Very naive "vector store": just keeps text and returns everything."""

    def __init__(self) -> None:
        self.data: Dict[str, List[Dict[str, Any]]] = {}

    def add(self, namespace: str, text: str) -> None:
        self.data.setdefault(namespace, []).append({"text": text, "timestamp": now_iso()})

    def search(self, namespace: str, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        all_items = self.data.get(namespace, [])
        return all_items[-top_k:]


class SimpleKVStore:
    def __init__(self) -> None:
        self.data: Dict[str, Any] = {}

    def set(self, key: str, value: Any) -> None:
        self.data[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        return self.data.get(key, default)


class MemoryLayer:
    def __init__(self, vector_store: SimpleVectorStore, kv_store: SimpleKVStore) -> None:
        self.vector = vector_store
        self.kv = kv_store

    def retrieve_relevant(self, user_id: str, query: str, k: int = 10) -> List[Dict[str, Any]]:
        return self.vector.search(namespace=user_id, query=query, top_k=k)

    def store_intermediate(self, user_id: str, objective: str, step: Step) -> None:
        record = {
            "user_id": user_id,
            "objective": objective,
            "step_description": step.description,
            "result": step.result,
            "timestamp": now_iso(),
        }
        self.vector.add(namespace=user_id, text=json_dump(record))

    def set_fact(self, user_id: str, key: str, value: Any) -> None:
        self.kv.set(f"{user_id}:{key}", value)

    def get_fact(self, user_id: str, key: str, default: Any = None) -> Any:
        return self.kv.get(f"{user_id}:{key}", default)


# =========================
# Safety / guardrails
# =========================


class SafetyManager:
    def __init__(self, policies: Optional[Dict[str, Any]] = None) -> None:
        self.policies = policies or {}

    def allowed_to_proceed(self, task: Task, step: Step) -> bool:
        return True

    def post_process(self, result: Any) -> Any:
        return result


# =========================
# Base Agent + concrete agents
# =========================


class BaseAgent(abc.ABC):
    def __init__(self, name: str, llm_client: LLMClient, tools: ToolRegistry, memory: MemoryLayer) -> None:
        self.name = name
        self.llm = llm_client
        self.tools = tools
        self.memory = memory

    @abc.abstractmethod
    def run(self, step: Step, task: Task) -> Any:
        raise NotImplementedError


class ResearchAgent(BaseAgent):
    def run(self, step: Step, task: Task) -> Any:
        system_prompt = (
            "You are a research agent. Decide what to search, read results, "
            "and synthesize them into a concise, useful report."
        )

        planning_resp = self.llm.chat(
            system=system_prompt,
            user=f"Objective: {task.objective}\nStep: {step.description}",
        )

        query = task.objective[:200]
        results = self.tools.call("web_search", query=query, max_results=3)

        fusion_resp = self.llm.chat(
            system="You are a synthesis engine. Combine sources into a report.",
            user=json_dump(
                {
                    "objective": task.objective,
                    "step": step.description,
                    "sources": results,
                    "planning_notes": planning_resp,
                }
            ),
        )
        return fusion_resp


class CodeAgent(BaseAgent):
    def run(self, step: Step, task: Task) -> Any:
        system_prompt = (
            "You are a senior software engineer. Given the task and context, "
            "describe what code changes or checks you would perform. "
            "You may request tests or static analysis, but this environment "
            "only simulates execution."
        )

        resp = self.llm.chat(
            system=system_prompt,
            user=f"Objective: {task.objective}\nStep: {step.description}",
        )

        fake_test_result = self.tools.call("run_code", language="bash", code="pytest -q")

        return "CODE ANALYSIS (SIMULATED):\n" + resp + "\n\nTEST RUN (SIMULATED):\n" + json_dump(fake_test_result)


class CommsAgent(BaseAgent):
    def run(self, step: Step, task: Task) -> Any:
        system_prompt = (
            "You are a communications agent. Turn the prior step results into a "
            "clear, concise explanation for a non-technical stakeholder."
        )

        prior_results = [
            {"description": s.description, "result": s.result}
            for s in task.plan
            if s.result is not None
        ]

        resp = self.llm.chat(
            system=system_prompt,
            user=json_dump(
                {
                    "objective": task.objective,
                    "step": step.description,
                    "prior_results": prior_results,
                }
            ),
        )
        return resp


# =========================
# Orchestrator
# =========================


class Orchestrator:
    def __init__(self, llm_client: LLMClient, agents: Dict[str, BaseAgent], memory: MemoryLayer, safety: SafetyManager) -> None:
        self.llm = llm_client
        self.agents = agents
        self.memory = memory
        self.safety = safety

    def handle_task(self, task: Task) -> Task:
        long_term = self.memory.retrieve_relevant(task.user_id, task.objective)
        task.context["memory"] = long_term

        task.plan = self._create_plan(task)

        for step in task.plan:
            if not self.safety.allowed_to_proceed(task, step):
                step.status = StepStatus.BLOCKED
                task.append_log(f"Step blocked by safety: {step.description}")
                break

            agent = self.agents.get(step.agent_name)
            if agent is None:
                step.status = StepStatus.ERROR
                task.append_log(f"No agent found: {step.agent_name}")
                continue

            task.append_log(f"Running step via agent '{step.agent_name}': {step.description}")
            step.mark_started()
            start = time.time()

            try:
                result = agent.run(step, task)
            except Exception as exc:  # pragma: no cover - defensive guard
                step.result = f"Agent '{agent.name}' failed: {exc}"
                step.status = StepStatus.ERROR
                step.mark_finished(duration=time.time() - start)
                task.status = TaskStatus.ERROR
                task.append_log(step.result)
                break

            elapsed = time.time() - start
            step.result = self.safety.post_process(result)
            step.status = StepStatus.DONE
            step.mark_finished(duration=elapsed)
            task.append_log(f"Step completed in {elapsed:.2f}s: {step.description}")

            self.memory.store_intermediate(task.user_id, task.objective, step)

        final_answer = self._summarize_results(task)
        task.context["final_answer"] = final_answer
        task.status = TaskStatus.COMPLETED
        return task

    def _create_plan(self, task: Task) -> List[Step]:
        system_prompt = (
            "You are a planner. Given a user objective and context, break it "
            "into 2–5 concrete steps. For each, choose an agent from: "
            "['research', 'code', 'comms']. "
            "Respond ONLY as strict JSON: "
            "{ \"steps\": [ {\"description\": \"...\", \"agent_name\": \"...\"}, ... ] }"
        )

        resp = self.llm.chat(system=system_prompt, user=task.objective)
        steps: List[Step] = []
        try:
            parsed = parse_json(resp)
            for s in parsed.get("steps", []):
                description = s.get("description")
                agent_name = s.get("agent_name")
                if not description or not agent_name:
                    continue
                steps.append(Step(description=description, agent_name=agent_name))
        except Exception as exc:  # pragma: no cover - defensive guard
            task.append_log(f"Plan parsing failed, falling back to single research step: {exc}")

        if not steps:
            steps.append(Step(description=task.objective, agent_name="research"))
        return steps

    def _summarize_results(self, task: Task) -> str:
        system_prompt = (
            "You are a senior analyst. Given the objective and the list of "
            "steps+results, produce a clear, actionable final answer."
        )

        steps_summary = [
            {"description": s.description, "result": s.result}
            for s in task.plan
        ]

        resp = self.llm.chat(
            system=system_prompt,
            user=json_dump({"objective": task.objective, "steps": steps_summary}),
        )
        return resp


# =========================
# Example usage
# =========================


def build_default_system(llm_client: Optional[LLMClient] = None) -> Orchestrator:
    llm_client = llm_client or DummyLLMClient()

    tools = ToolRegistry()
    tools.register("web_search", web_search_tool)
    tools.register("read_file", read_file_tool)
    tools.register("run_code", run_code_tool)

    vector_store = SimpleVectorStore()
    kv_store = SimpleKVStore()
    memory_layer = MemoryLayer(vector_store, kv_store)

    safety = SafetyManager()

    agents: Dict[str, BaseAgent] = {
        "research": ResearchAgent("research", llm_client, tools, memory_layer),
        "code": CodeAgent("code", llm_client, tools, memory_layer),
        "comms": CommsAgent("comms", llm_client, tools, memory_layer),
    }

    orchestrator = Orchestrator(llm_client, agents, memory_layer, safety)
    return orchestrator


if __name__ == "__main__":
    # Example wiring. To swap in a real LLM client, instantiate the desired
    # implementation (e.g., OpenAIChatClient) and pass it to build_default_system.
    #
    # >>> orch = build_default_system(OpenAIChatClient(model="gpt-4o-mini"))
    # >>> task = Task(user_id="user-123", objective="Audit this codebase for security issues.")
    # >>> completed = orch.handle_task(task)
    # >>> print(completed.context["final_answer"])

    orch = build_default_system()

    task = Task(
        user_id="user-123",
        objective="Audit this codebase for obvious security issues and draft a remediation plan.",
    )

    completed = orch.handle_task(task)

    print("=== FINAL ANSWER ===")
    print(completed.context["final_answer"])
    print("\n=== LOGS ===")
    for log in completed.logs:
        print("-", log)
